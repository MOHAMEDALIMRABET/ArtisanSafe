import Link from 'next/link';
import Image from 'next/image';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
}

export function Logo({ variant = 'full', size = 'md', href = '/' }: LogoProps) {
  const sizes = {
    sm: { width: 200, height: 50 },
    md: { width: 300, height: 75 },
    lg: { width: 400, height: 100 },
  };

  const { width, height } = sizes[size];

  const LogoContent = () => {
    return (
      <div className="flex items-center">
        <img
          src="/images/Logo-artisandispo.png"
          alt="ArtisanDispo - Trouvez votre artisan de confiance"
          width={width}
          height={height}
          className="h-auto object-contain"
        />
      </div>
    );
  };

  if (href) {
    return (
      <Link href={href} className="inline-block hover:opacity-90 transition-opacity">
        <LogoContent />
      </Link>
    );
  }

  return <LogoContent />;
}
