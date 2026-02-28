'use client';

import { useState, useEffect } from 'react';
import Login from '@/components/Login';
import Chat from '@/components/Chat';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token and validate it
    const validateToken = async () => {
      const savedToken = localStorage.getItem('scorer_token');
      const savedName = localStorage.getItem('scorer_name');
      
      if (savedToken && savedName) {
        try {
          // Verify token is still valid
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          
          if (res.ok) {
            setToken(savedToken);
            setUserName(savedName);
          } else {
            // Token expired or invalid - clear it
            localStorage.removeItem('scorer_token');
            localStorage.removeItem('scorer_name');
          }
        } catch {
          // API unreachable - keep token for now
          setToken(savedToken);
          setUserName(savedName);
        }
      }
      setIsLoading(false);
    };
    
    validateToken();
  }, []);

  const handleLogin = (newToken: string, name: string) => {
    localStorage.setItem('scorer_token', newToken);
    localStorage.setItem('scorer_name', name);
    setToken(newToken);
    setUserName(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('scorer_token');
    localStorage.removeItem('scorer_name');
    setToken(null);
    setUserName('');
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return <Chat token={token} userName={userName} onLogout={handleLogout} />;
}
