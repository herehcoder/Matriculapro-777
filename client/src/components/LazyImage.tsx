import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholder?: string;
  threshold?: number;
}

/**
 * Componente otimizado para carregamento lazy de imagens
 * Só carrega a imagem quando ela está próxima ou visível no viewport
 */
export default function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlZWVlZWUiLz48L3N2Zz4=',
  threshold = 0.1,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        threshold, // % de visibilidade necessária para considerar "em vista"
        rootMargin: '100px' // Carregar um pouco antes da imagem entrar no viewport
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [threshold]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const imgSrc = inView ? src : placeholder;

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : 'auto' }}
    >
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        width={width}
        height={height}
        onLoad={handleLoad}
        loading="lazy"
      />
      
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' }}
        />
      )}
    </div>
  );
}