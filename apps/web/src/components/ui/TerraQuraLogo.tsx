"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface TerraQuraLogoProps {
  className?: string;
  height?: number;
}

export function TerraQuraLogo({
  className,
  height = 40,
}: TerraQuraLogoProps) {
  const width = Math.round(height * 3.14);
  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ height, width }}
    >
      <Image
        src="/logo.png"
        alt="TerraQura"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}

export function TerraQuraLogoFull({
  className,
  imageHeight = 40,
}: {
  className?: string;
  imageHeight?: number;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <TerraQuraLogo height={imageHeight} />
    </div>
  );
}

export function TerraQuraLogoCompact({
  className,
  height = 36,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <TerraQuraLogo
      className={className}
      height={height}
    />
  );
}

export function TerraQuraIcon({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <TerraQuraLogo
      className={className}
      height={size}
    />
  );
}

export default TerraQuraLogoFull;
