import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
}

export function Logo({ variant = 'full', size = 'md', href = '/' }: LogoProps) {
  const sizes = {
    sm: { icon: 32, full: 120 },
    md: { icon: 40, full: 160 },
    lg: { icon: 56, full: 200 },
  };

  const iconSize = sizes[size].icon;
  const fullWidth = sizes[size].full;

  const LogoContent = () => {
    if (variant === 'icon') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#FF6B00] rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-[#2C3E50]">
            <span className="text-[#2C5F3F]">Artisan</span>
            <span className="text-[#FF6B00]">Dispo</span>
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center">
        <Image
          src="/logo-artisandispo.svg"
          alt="ArtisanDispo - Trouvez votre artisan de confiance"
          width={fullWidth}
          height={iconSize}
          priority
          className="h-auto"
        />
      </div>
    );
  };

  if (href) {
    return (
      <Link href={href} className="inline-block">
        <LogoContent />
      </Link>
    );
  }

  return <LogoContent />;
}
