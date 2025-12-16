import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
            <h2 className="text-4xl font-bold mb-4 text-primary">404</h2>
            <p className="text-xl mb-8">Could not find requested resource</p>
            <Link
                href="/dashboard"
                className="px-6 py-3 bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-gray-200 transition-colors rounded"
            >
                Return to Dashboard
            </Link>
        </div>
    );
}
