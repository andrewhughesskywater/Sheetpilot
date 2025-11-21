/// Authentication and session management tests
#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use std::collections::HashMap;

    // Mock SessionManager for testing
    struct SessionManager {
        sessions: Arc<Mutex<HashMap<String, String>>>,
    }
    
    impl SessionManager {
        async fn create_session(&self, username: String) -> String {
            let session_id = uuid::Uuid::new_v4().to_string();
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.clone(), username);
            session_id
        }
        
        async fn validate_session(&self, session_id: &str) -> bool {
            let sessions = self.sessions.lock().await;
            sessions.contains_key(session_id)
        }
        
        async fn get_session_username(&self, session_id: &str) -> Option<String> {
            let sessions = self.sessions.lock().await;
            sessions.get(session_id).cloned()
        }
        
        async fn destroy_session(&self, session_id: &str) {
            let mut sessions = self.sessions.lock().await;
            sessions.remove(session_id);
        }
    }

    fn create_test_manager() -> SessionManager {
        SessionManager {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[tokio::test]
    async fn test_create_session() {
        let manager = create_test_manager();
        let username = "test_user";
        
        let session_id = manager.create_session(username.to_string()).await;
        
        assert!(!session_id.is_empty());
        assert_eq!(session_id.len(), 36); // UUID v4 length
    }

    #[tokio::test]
    async fn test_validate_session_valid() {
        let manager = create_test_manager();
        let username = "test_user";
        
        let session_id = manager.create_session(username.to_string()).await;
        let is_valid = manager.validate_session(&session_id).await;
        
        assert!(is_valid);
    }

    #[tokio::test]
    async fn test_validate_session_invalid() {
        let manager = create_test_manager();
        let fake_session_id = "invalid-session-id";
        
        let is_valid = manager.validate_session(fake_session_id).await;
        
        assert!(!is_valid);
    }

    #[tokio::test]
    async fn test_get_session_username() {
        let manager = create_test_manager();
        let username = "test_user";
        
        let session_id = manager.create_session(username.to_string()).await;
        let retrieved_username = manager.get_session_username(&session_id).await;
        
        assert!(retrieved_username.is_some());
        assert_eq!(retrieved_username.unwrap(), username);
    }

    #[tokio::test]
    async fn test_get_session_username_invalid() {
        let manager = create_test_manager();
        let fake_session_id = "invalid-session-id";
        
        let retrieved_username = manager.get_session_username(fake_session_id).await;
        
        assert!(retrieved_username.is_none());
    }

    #[tokio::test]
    async fn test_destroy_session() {
        let manager = create_test_manager();
        let username = "test_user";
        
        let session_id = manager.create_session(username.to_string()).await;
        assert!(manager.validate_session(&session_id).await);
        
        manager.destroy_session(&session_id).await;
        assert!(!manager.validate_session(&session_id).await);
    }

    #[tokio::test]
    async fn test_multiple_sessions() {
        let manager = create_test_manager();
        
        let session1 = manager.create_session("user1".to_string()).await;
        let session2 = manager.create_session("user2".to_string()).await;
        
        // Both sessions should be valid
        assert!(manager.validate_session(&session1).await);
        assert!(manager.validate_session(&session2).await);
        
        // Different session IDs
        assert_ne!(session1, session2);
        
        // Correct usernames
        assert_eq!(manager.get_session_username(&session1).await.unwrap(), "user1");
        assert_eq!(manager.get_session_username(&session2).await.unwrap(), "user2");
    }

    #[tokio::test]
    async fn test_destroy_one_session_doesnt_affect_others() {
        let manager = create_test_manager();
        
        let session1 = manager.create_session("user1".to_string()).await;
        let session2 = manager.create_session("user2".to_string()).await;
        
        // Destroy session1
        manager.destroy_session(&session1).await;
        
        // session1 should be invalid, session2 should still be valid
        assert!(!manager.validate_session(&session1).await);
        assert!(manager.validate_session(&session2).await);
    }

    #[tokio::test]
    async fn test_session_id_is_unique() {
        let manager = create_test_manager();
        
        let session1 = manager.create_session("user1".to_string()).await;
        let session2 = manager.create_session("user1".to_string()).await; // Same username
        
        // Even with same username, session IDs should be different
        assert_ne!(session1, session2);
    }

    #[tokio::test]
    async fn test_concurrent_session_operations() {
        let manager = Arc::new(create_test_manager());
        let mut handles = vec![];
        
        // Create 10 sessions concurrently
        for i in 0..10 {
            let manager_clone: Arc<SessionManager> = Arc::clone(&manager);
            let handle = tokio::spawn(async move {
                let username = format!("user{}", i);
                manager_clone.create_session(username).await
            });
            handles.push(handle);
        }
        
        // Wait for all to complete
        let mut session_ids = vec![];
        for handle in handles {
            let session_id = handle.await.unwrap();
            session_ids.push(session_id);
        }
        
        // All sessions should be valid
        for session_id in &session_ids {
            assert!(manager.validate_session(session_id).await);
        }
        
        // All session IDs should be unique
        let unique_ids: std::collections::HashSet<_> = session_ids.iter().collect();
        assert_eq!(unique_ids.len(), 10);
    }
}

