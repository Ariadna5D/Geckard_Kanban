import type { CSSProperties } from 'react';

const LOCKUP_SRC = '/geckard-lockup.png';

// Mascara para pintar el logo con color del tema
const lockupMaskStyle: CSSProperties = {
  WebkitMaskImage: `url(${LOCKUP_SRC})`,
  maskImage: `url(${LOCKUP_SRC})`,
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'left center',
  maskPosition: 'left center',
  WebkitMaskSourceType: 'luminance',
  maskSourceType: 'luminance',
};

type BrandMarkProps = {
  className?: string;
  imgClassName?: string;
};

// Muestra la marca principal con su imagen de lockup
export function BrandMark({
  className = '',
  imgClassName = 'h-9 w-auto sm:h-10',
}: BrandMarkProps) {
  return (
    <div className={`relative inline-block align-middle ${className}`}>
      {/* Imagen base invisible que define tamano natural del lockup */}
      <img
        src={LOCKUP_SRC}
        alt=""
        aria-hidden
        className={`pointer-events-none block max-w-full select-none opacity-0 ${imgClassName}`}
        decoding="async"
      />
      {/* Capa visible con color actual aplicando la mascara del logo */}
      <div
        className="absolute inset-0 bg-primary-600 dark:bg-primary-400"
        style={lockupMaskStyle}
        aria-hidden
      />
      <span className="sr-only">Geckard</span>
    </div>
  );
}
