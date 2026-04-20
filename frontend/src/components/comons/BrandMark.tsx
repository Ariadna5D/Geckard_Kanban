import type { CSSProperties } from 'react';

const LOCKUP_SRC = '/geckard-lockup.png';

const lockupMaskStyle: CSSProperties = {
  WebkitMaskImage: `url(${LOCKUP_SRC})`,
  maskImage: `url(${LOCKUP_SRC})`,
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'left center',
  maskPosition: 'left center',
  /* Negro sobre blanco en el PNG → la tinta sigue la silueta del logo */
  WebkitMaskSourceType: 'luminance',
  maskSourceType: 'luminance',
};

type BrandMarkProps = {
  /** Clases del contenedor */
  className?: string;
  /**
   * Lockup completo: icono G + "ECKARD".
   * Altura fija + ancho automático (el `<img>` invisible fija el tamaño).
   */
  imgClassName?: string;
};

/**
 * Marca Geckard: lockup en color `primary` (claro/oscuro), sin forzar blanco en dark mode.
 */
export function BrandMark({
  className = '',
  imgClassName = 'h-9 w-auto sm:h-10',
}: BrandMarkProps) {
  return (
    <div className={`relative inline-block align-middle ${className}`}>
      <img
        src={LOCKUP_SRC}
        alt=""
        aria-hidden
        className={`pointer-events-none block max-w-full select-none opacity-0 ${imgClassName}`}
        decoding="async"
      />
      <div
        className="absolute inset-0 bg-primary-600 dark:bg-primary-400"
        style={lockupMaskStyle}
        aria-hidden
      />
      <span className="sr-only">Geckard</span>
    </div>
  );
}
