import type { GasCode, GasConfig, TankPreset } from '../types/gas';

export const GAS_CATALOG: Record<GasCode, GasConfig> = {
  N2: {
    code: 'N2',
    symbol: 'N₂',
    name: 'Nitrógeno',
    accent: '#4CC9FF',
    category: 'Gas Inerte Industrial',
    application: 'Purgado, presurización, corte láser y conservación',
    tips: [
      'Cierra la válvula principal al terminar cada turno; los reguladores con microfugas pueden perder hasta 8% semanal.',
      'Usa presión de trabajo justa en purgas y pruebas de hermeticidad para evitar sobreconsumo innecesario.',
      'Revisa con agua jabonosa las conexiones rápidas y mangueras cada semana; el N₂ es inodoro y no delata fugas.',
    ],
    safetyNote: 'Gas asfixiante simple. Opera siempre en áreas ventiladas para evitar desplazamiento de oxígeno.',
  },
  Ar: {
    code: 'Ar',
    symbol: 'Ar',
    name: 'Argón',
    accent: '#B366FF',
    category: 'Gas Noble de Protección',
    application: 'Soldadura TIG/MIG y atmósferas inertes de laboratorio',
    tips: [
      'Ajusta el flujómetro entre 8 y 12 L/min en soldadura TIG; un flujo excesivo genera turbulencia y desperdicia gas.',
      'Instala un economizador de gas en la antorcha para eliminar picos de presión al abrir el gatillo.',
      'Comprueba el post-flujo (post-flow): entre 5 y 8 segundos suele ser suficiente para proteger el tungsteno.',
    ],
    safetyNote: 'Más denso que el aire; puede acumularse en fosas o espacios confinados.',
  },
  CO2: {
    code: 'CO2',
    symbol: 'CO₂',
    name: 'Dióxido de Carbono',
    accent: '#FF4FD8',
    category: 'Gas Licuado a Presión',
    application: 'Soldadura MAG, bebidas carbonatadas e invernaderos',
    tips: [
      'Mantén el cilindro siempre en posición vertical para extraer fase gas y evitar congelamiento del regulador.',
      'Evita exponer el cilindro a fuentes directas de calor; los cambios bruscos de temperatura elevan la presión interna.',
      'Purga únicamente el tiempo mínimo requerido en líneas de carbonatación o soldadura para ahorrar hasta 15%.',
    ],
    safetyNote: 'El pesaje con báscula es el único método preciso para CO₂, ya que su presión permanece constante mientras haya líquido.',
  },
  O2: {
    code: 'O2',
    symbol: 'O₂',
    name: 'Oxígeno',
    accent: '#6E7BFF',
    category: 'Gas Medicinal / Oxidante',
    application: 'Uso medicinal, oxicorte y procesos de combustión',
    tips: [
      'Programa recargas al llegar al 20% para garantizar continuidad operativa en aplicaciones críticas o medicinales.',
      'Verifica la calibración del flujómetro periódicamente para evitar dosificaciones por encima de lo requerido.',
      'Inspecciona juntas y empaques de reguladores sin usar grasas ni aceites; sustituye piezas desgastadas de inmediato.',
    ],
    safetyNote: 'Nunca utilices aceites, grasas ni lubricantes en válvulas o conexiones de oxígeno: riesgo severo de ignición.',
  },
  LP: {
    code: 'LP',
    symbol: 'LP',
    name: 'Gas LP',
    accent: '#FF3B5C',
    category: 'Gas Combustible Licuado',
    application: 'Calefacción, cocinas industriales, montacargas y hornos',
    tips: [
      'Mantén los quemadores limpios con flama azul estable; una flama amarilla indica mala combustión y desperdicio.',
      'Revisa reguladores de baja/alta presión cada 6 meses para prevenir fugas silenciosas en las uniones.',
      'Agrupa lotes de cocción o calentamiento continuo en lugar de encendidos breves repetitivos para reducir consumo.',
    ],
    safetyNote: 'Gas inflamable más pesado que el aire. Almacena en exteriores ventilados y lejos de fuentes de ignición.',
  },
};

export const GAS_ORDER: GasCode[] = ['N2', 'Ar', 'CO2', 'O2', 'LP'];

export const TANK_PRESETS: TankPreset[] = [
  {
    id: 'small',
    label: 'Chico · 10 kg',
    shortLabel: 'Chico',
    capacityKg: 10,
    tareKg: 8,
  },
  {
    id: 'medium',
    label: 'Mediano · 20 kg',
    shortLabel: 'Mediano',
    capacityKg: 20,
    tareKg: 12,
  },
  {
    id: 'large',
    label: 'Grande · 30 kg',
    shortLabel: 'Grande',
    capacityKg: 30,
    tareKg: 22,
  },
  {
    id: 'industrial',
    label: 'Industrial · 50 kg',
    shortLabel: 'Industrial',
    capacityKg: 50,
    tareKg: 35,
  },
];
