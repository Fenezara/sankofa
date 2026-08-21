"use client";

/**
 * Sankofa — Hook de détection de capacité device
 *
 * Détecte navigator.hardwareConcurrency et navigator.deviceMemory
 * pour dégrader gracieusement les animations sur devices faibles
 * (Tecno/Infinix/Itel, 2-4 Go RAM, MediaTek Helio A22/G35).
 */

import * as React from "react";

export interface DeviceCapability {
  isLowEnd: boolean;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  isMobile: boolean;
  prefersReducedMotion: boolean;
}

export function useDeviceCapability(): DeviceCapability {
  const [state, setState] = React.useState<DeviceCapability>({
    isLowEnd: false,
    hardwareConcurrency: null,
    deviceMemory: null,
    isMobile: false,
    prefersReducedMotion: false,
  });

  React.useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const hc = nav.hardwareConcurrency ?? null;
    const dm = nav.deviceMemory ?? null;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Heuristique : low-end si < 4 cores OU < 4 Go RAM
    const isLowEnd =
      (hc !== null && hc < 4) || (dm !== null && dm < 4) || prefersReducedMotion;

    setState({
      isLowEnd,
      hardwareConcurrency: hc,
      deviceMemory: dm,
      isMobile,
      prefersReducedMotion,
    });
  }, []);

  return state;
}

export default useDeviceCapability;
