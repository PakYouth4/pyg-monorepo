import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export interface Report {
    id: string;
    topic: string;
    date: string; // ISO string from Firestore
    summary: string;
    ideas: string;
    docUrl: string;
    type: 'weekly' | 'manual';
    status?: 'generating' | 'completed';
    isPublic: boolean;
    userId?: string;
}

export function useReports() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth(); // Reactive user state

    useEffect(() => {
        // Don't query if user is not authenticated yet
        if (!user) {
            setReports([]);
            setLoading(false);
            return;
        }

        // Query only reports owned by the current user
        const q = query(
            collection(db, 'reports'),
            where('userId', '==', user.uid),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const fetchedReports: Report[] = snapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            topic: data.topic || 'General Weekly',
                            date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
                            summary: data.summary || '',
                            ideas: data.ideas || '',
                            docUrl: data.docUrl || '#',
                            type: data.type || 'weekly',
                            status: data.status || 'completed',
                            isPublic: data.isPublic || false,
                            userId: data.userId
                        };
                    })
                    .filter(report => {
                        // Filter out generating reports
                        if (report.status === 'generating') return false;
                        return true;
                    });

                setReports(fetchedReports);
                setLoading(false);
            } catch (err) {
                console.error("Error processing reports:", err);
                setError("Failed to process data");
                setLoading(false);
            }
        }, (err) => {
            console.error("Error fetching reports:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]); // Re-run when user changes (login/logout)

    const deleteReport = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'reports', id));
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error("Error deleting report:", err);
            throw err;
        }
    };

    return { reports, loading, error, deleteReport };
}
