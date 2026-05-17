export default function Footer() {
  return (
    <footer className="border-t border-krishi-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-gray-600 sm:flex-row sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Smart Krishi Market — Empowering farmers with AI.</p>
        <p className="text-krishi-700">Built for practical mandi decisions.</p>
      </div>
    </footer>
  );
}
