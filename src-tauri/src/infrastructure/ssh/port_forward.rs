use ssh2::Session;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

pub fn start_local_forward(
    session: Arc<Mutex<Session>>,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
) -> Result<(), String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))
        .map_err(|e| format!("Failed to bind local port {}: {}", local_port, e))?;

    // We spawn a thread to accept incoming TCP connections on the local port
    thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    let session_clone = Arc::clone(&session);
                    let remote_host = remote_host.clone();
                    
                    // For each connection, we spawn a thread to handle it
                    thread::spawn(move || {
                        if let Err(e) = handle_forwarding(session_clone, stream, remote_host, remote_port) {
                            eprintln!("Port forwarding error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Failed to accept incoming TCP connection: {}", e);
                }
            }
        }
    });

    Ok(())
}

fn handle_forwarding(
    session: Arc<Mutex<Session>>,
    mut local_stream: TcpStream,
    remote_host: String,
    remote_port: u16,
) -> Result<(), String> {
    let mut channel = {
        let session_guard = session.lock().map_err(|_| "Failed to lock session")?;
        session_guard
            .channel_direct_tcpip(&remote_host, remote_port, None)
            .map_err(|e| format!("Failed to create SSH channel: {}", e))?
    };

    let mut local_stream_clone = local_stream
        .try_clone()
        .map_err(|e| format!("Failed to clone local stream: {}", e))?;

    // Use a small read timeout instead of pure non-blocking to prevent busy-loop CPU waste
    local_stream.set_read_timeout(Some(std::time::Duration::from_millis(5))).unwrap_or_default();
    // Ensure it's not in non-blocking mode
    local_stream.set_nonblocking(false).unwrap_or_default();
    
    let mut buf = [0u8; 8192];
    loop {
        let mut activity = false;
        
        // Read from local TCP and write to SSH
        match local_stream.read(&mut buf) {
            Ok(0) => break, // Connection closed
            Ok(n) => {
                let mut written = 0;
                while written < n {
                    let write_res = {
                        let session_guard = match session.lock() {
                            Ok(guard) => guard,
                            Err(_) => break,
                        };
                        // Short timeout to prevent deadlocks if the SSH window is full
                        session_guard.set_timeout(500); 
                        let res = channel.write(&buf[written..n]);
                        session_guard.set_timeout(0);
                        res
                    };

                    match write_res {
                        Ok(0) => break,
                        Ok(w) => written += w,
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {
                            std::thread::sleep(std::time::Duration::from_millis(1));
                        }
                        Err(_) => break, // Channel error
                    }
                }
                activity = true;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {}
            Err(_) => break,
        }

        // Read from SSH and write to local TCP
        let read_res = {
            let session_guard = match session.lock() {
                Ok(guard) => guard,
                Err(_) => break,
            };
            // Use a short timeout to poll the channel without blocking the entire session indefinitely
            session_guard.set_timeout(5); 
            let res = channel.read(&mut buf);
            session_guard.set_timeout(0); // Restore blocking mode for other threads
            res
        };

        match read_res {
            Ok(0) => {
                if channel.eof() {
                    break;
                }
            }
            Ok(n) => {
                if local_stream_clone.write_all(&buf[..n]).is_err() {
                    break;
                }
                activity = true;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {}
            Err(_) => break,
        }
        
        if !activity {
            std::thread::sleep(std::time::Duration::from_millis(1));
        }
    }
    
    let _ = channel.send_eof();
    let _ = channel.wait_eof();
    let _ = channel.close();
    let _ = channel.wait_close();
    
    Ok(())
}
