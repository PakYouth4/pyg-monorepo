import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/navigation';

export function useAuth(requireAuth = false, redirectIfAuthenticated = false) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);

            if (requireAuth && !currentUser) {
                router.push('/login');
            }

            if (redirectIfAuthenticated && currentUser) {
                router.push('/dashboard');
            }
        });

        return () => unsubscribe();
    }, [requireAuth, redirectIfAuthenticated, router]);

    return { user, loading };
}
