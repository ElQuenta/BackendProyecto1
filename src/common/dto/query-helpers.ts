// Utilidades compartidas por los DTOs de consulta (query string) y los servicios de busqueda

// 'true' / 'false' (texto del query string) -> boolean. Cualquier otro valor se deja igual para que IsBoolean lo rechace
export const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

// Escapa los caracteres especiales para usar texto del usuario dentro de una RegExp
export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const textPattern = (text: string): RegExp => new RegExp(escapeRegex(text.trim()), 'i');
