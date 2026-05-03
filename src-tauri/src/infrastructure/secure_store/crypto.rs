use argon2::Argon2;
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use rand::Rng;
use crate::app::errors::AppError;
use argon2::password_hash::SaltString;

pub struct CryptoManager;

impl CryptoManager {
    /// Derives a 32-byte key from a password and salt using Argon2id
    pub fn derive_key(password: &str, salt: &str) -> Result<[u8; 32], AppError> {
        use argon2::{Algorithm, Params, Version};

        let salt_bytes = salt.as_bytes();
        let mut key = [0u8; 32];
        
        // Explicitly set parameters to ensure consistency
        // m_cost: 16MB, t_cost: 2, p_cost: 1
        let params = Params::new(16384, 2, 1, Some(32))
            .map_err(|e| AppError::Internal(format!("Invalid Argon2 params: {}", e)))?;
            
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        
        argon2.hash_password_into(password.as_bytes(), salt_bytes, &mut key)
            .map_err(|e| AppError::Internal(format!("Key derivation failed: {}", e)))?;
            
        Ok(key)
    }

    /// Encrypts data using XChaCha20-Poly1305
    pub fn encrypt(data: &[u8], key: &[u8; 32]) -> Result<(Vec<u8>, Vec<u8>), AppError> {
        let cipher = XChaCha20Poly1305::new(key.into());
        let nonce_bytes: [u8; 24] = rand::thread_rng().gen();
        let nonce = XNonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| AppError::Internal(format!("Encryption failed: {}", e)))?;
        
        Ok((ciphertext, nonce_bytes.to_vec()))
    }

    /// Decrypts data using XChaCha20-Poly1305
    pub fn decrypt(ciphertext: &[u8], key: &[u8; 32], nonce_bytes: &[u8]) -> Result<Vec<u8>, AppError> {
        let cipher = XChaCha20Poly1305::new(key.into());
        let nonce = XNonce::from_slice(nonce_bytes);
        
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| AppError::Internal(format!("Decryption failed: {}", e)))?;
        
        Ok(plaintext)
    }

    /// Generates a random salt for Argon2
    pub fn generate_salt() -> String {
        SaltString::generate(&mut rand::thread_rng()).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key_consistency() {
        let password = "test_password";
        let salt = "test_salt";
        
        let key1 = CryptoManager::derive_key(password, salt).unwrap();
        let key2 = CryptoManager::derive_key(password, salt).unwrap();
        
        assert_eq!(key1, key2, "Derivation should be deterministic for same password and salt");
    }

    #[test]
    fn test_derive_key_uniqueness() {
        let password = "test_password";
        let salt1 = "salt_length_8";
        let salt2 = "salt_length_9";
        
        let key1 = CryptoManager::derive_key(password, salt1).unwrap();
        let key2 = CryptoManager::derive_key(password, salt2).unwrap();
        
        assert_ne!(key1, key2, "Different salts should produce different keys");
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = [0u8; 32]; // Fixed key for testing
        let original_data = b"hello world axon term secret";
        
        let (ciphertext, nonce) = CryptoManager::encrypt(original_data, &key).unwrap();
        assert_ne!(original_data.to_vec(), ciphertext, "Ciphertext should not be plaintext");
        
        let decrypted_data = CryptoManager::decrypt(&ciphertext, &key, &nonce).unwrap();
        assert_eq!(original_data.to_vec(), decrypted_data, "Decrypted data should match original");
    }

    #[test]
    fn test_decrypt_fail_with_wrong_key() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];
        let data = b"secret";
        
        let (ciphertext, nonce) = CryptoManager::encrypt(data, &key1).unwrap();
        let result = CryptoManager::decrypt(&ciphertext, &key2, &nonce);
        
        assert!(result.is_err(), "Decryption should fail with wrong key");
    }

    #[test]
    fn test_generate_salt() {
        let salt1 = CryptoManager::generate_salt();
        let salt2 = CryptoManager::generate_salt();
        
        assert_ne!(salt1, salt2, "Generated salts should be unique");
        assert!(!salt1.is_empty());
    }
}
