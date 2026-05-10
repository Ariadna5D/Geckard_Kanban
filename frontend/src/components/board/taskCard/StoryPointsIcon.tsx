import type { CSSProperties } from 'react';

type StoryPointsIconProps = {
  className?: string;
};

const maskStyle: CSSProperties = {
  WebkitMaskImage: "url('/story-points.png')",
  maskImage: "url('/story-points.png')",
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  backgroundColor: 'currentColor',
};

export function StoryPointsIcon({ className }: StoryPointsIconProps) {
  // Pinta el icono de puntos con mascara
  let finalClassName = 'inline-block size-7 shrink-0';
  if (className) {
    // Permite pasar tamano y color desde el componente padre
    finalClassName = `${finalClassName} ${className}`;
  }

  return (
    <span
      className={finalClassName}
      style={maskStyle}
      aria-hidden
    />
  );
}
