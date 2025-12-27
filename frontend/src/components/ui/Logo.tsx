import Link from 'next/link';
import Image from 'next/image';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
}

export function Logo({ variant = 'full', size = 'md', href = '/' }: LogoProps) {
  const sizes = {
    sm: { width: 120, height: 40 },
    md: { width: 160, height: 50 },
    lg: { width: 200, height: 65 },
  };

  const { width, height } = sizes[size];

  const LogoContent = () => {
    // Utiliser le SVG optimisé
    return (
      <div className="flex items-center">
        <Image
          src="/logo-artisandispo.svg"
          alt="ArtisanDispo - Trouvez votre artisan de confiance"
          width={width}
          height={height}
          priority
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
