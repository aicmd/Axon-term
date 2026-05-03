use crate::domain::host::Host;
use crate::infrastructure::ssh::auth;
use ssh2::Session;
use std::io::Read;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;



fn resolve_socket(host: &Host) -> Result<SocketAddr, String> {
    (host.address.as_str(), host.port)
        .to_socket_addrs()
        .map_err(|err| err.to_string())?
        .next()
        .ok_or_else(|| format!("unable to resolve {}:{}", host.address, host.port))
}

pub fn connect(host: &Host) -> Result<Session, String> {
    let socket = resolve_socket(host)?;
    let tcp = TcpStream::connect_timeout(&socket, Duration::from_secs(10))
        .map_err(|err| format!("failed to connect to {}:{}: {}", host.address, host.port, err))?;
    tcp.set_read_timeout(Some(Duration::from_secs(20)))
        .map_err(|err| err.to_string())?;
    tcp.set_write_timeout(Some(Duration::from_secs(20)))
        .map_err(|err| err.to_string())?;

    let mut session = Session::new().map_err(|err| err.to_string())?;
    session.set_tcp_stream(tcp);
    session.handshake().map_err(|err| format!("ssh handshake failed: {}", err))?;

    auth::authenticate(&mut session, host).map_err(|err| err.to_string())?;

    if session.authenticated() {
        Ok(session)
    } else {
        Err("ssh session was created but not authenticated".into())
    }
}

pub fn detect_remote_os(session: &mut Session) -> Option<String> {
    let mut channel = session.channel_session().ok()?;
    // Using uname -a which is very portable
    channel.exec("uname -a").ok()?;

    let mut s = String::new();
    channel.read_to_string(&mut s).ok()?;
    let output = s.to_lowercase();

    channel.wait_close().ok()?;
    let exit_status = channel.exit_status().ok()?;

    if exit_status == 0 {
        if output.contains("linux") {
            if output.contains("ubuntu") {
                return Some("linux-ubuntu".into());
            } else if output.contains("debian") {
                return Some("linux-debian".into());
            } else if output.contains("centos") {
                return Some("linux-centos".into());
            } else if output.contains("fedora") {
                return Some("linux-fedora".into());
            } else if output.contains("red hat") || output.contains("rhel") {
                return Some("linux-rhel".into());
            } else if output.contains("arch") {
                return Some("linux-arch".into());
            } else if output.contains("alpine") {
                return Some("linux-alpine".into());
            } else if output.contains("suse") || output.contains("opensuse") {
                return Some("linux-suse".into());
            } else {
                return Some("linux".into());
            }
        } else if output.contains("darwin") || output.contains("mac os x") {
            return Some("macos".into());
        } else if output.contains("windows") {
            return Some("windows".into());
        } else if output.contains("freebsd") {
            return Some("freebsd".into());
        } else if output.contains("openbsd") {
            return Some("openbsd".into());
        }
    }
    
    None
}
