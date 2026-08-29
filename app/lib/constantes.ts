export const PLAN_PRECIOS: Record<string, number> = {
  MBPS_200: 50,
  MBPS_400: 60,
  MBPS_600: 70,
  MBPS_800: 90,
  GBPS_1: 120,
};

export const PLAN_LABELS: Record<string, string> = {
  MBPS_200: "200 Mbps",
  MBPS_400: "400 Mbps",
  MBPS_600: "600 Mbps",
  MBPS_800: "800 Mbps",
  GBPS_1: "1 Gbps",
};

// Cantidad exacta de caracteres esperada según el tipo de documento
export const LONGITUD_DOCUMENTO: Record<string, number> = {
  DNI: 8,
  RUC: 11,
  CE: 9,
  PASAPORTE: 9,
};

export const MATERIALES: { value: string; label: string }[] = [
  { value: "ACOMETIDA", label: "Acometida" },
  { value: "ROSETA", label: "Roseta" },
  { value: "ROUTER_GPON", label: "Router GPON" },
  { value: "PIG_TAIL", label: "Pig Tail" },
  { value: "CONTENEDOR_MECANICO", label: "Contenedor Mecánico" },
  { value: "GRAPAS", label: "Grapas" },
  { value: "FUSION", label: "Fusión" },
  { value: "PARCH_CORD", label: "Parch Cord" },
  { value: "SMOOT", label: "Smoot" },
];
