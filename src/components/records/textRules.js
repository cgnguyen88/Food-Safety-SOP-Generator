/**
 * Bilingual strings for the screens that connect records to each other (the sanitizer check, field holds, the
 * training due list, lot codes, tracing and the mock recall). Merged into RECORDS_TEXT by text.js.
 */
export const RULES_TEXT = {
  en: {
    sanitizerCheck: {
      pass: (range) => `Within the label range (${range}).`,
      too_low: (range) => `Too low. The label says ${range}.`,
      too_high: (range) => `Too high. The label says ${range}.`,
      no_label: 'There is no approved label for this sanitizer yet, so the concentration can’t be checked. Add its label under Sanitizer Labels.',
      no_range: 'The label for this sanitizer gives no concentration range, so the concentration can’t be checked.',
      checking: 'Checking the sanitizer labels…',
      automatic: 'Filled in from the label.',
      range: {
        between: (min, max) => `${min} to ${max} ppm`,
        atLeast: (min) => `at least ${min} ppm`,
        upTo: (max) => `up to ${max} ppm`,
      },
    },
    holds: {
      title: 'Fields on hold',
      intro: 'Don’t harvest from these fields, or give their produce a lot code, until a corrective action clears the hold.',
      since: (date) => (date ? `On hold since ${date}` : 'On hold'),
      reason: { crop_contact: 'Water, ash or debris reached the crop', animal_signs: 'Signs of animals found' },
      clear: 'Record corrective action',
      badge: 'On hold',
      harvestWarning: (field) => `${field} is on hold. Record the corrective action that clears it before harvesting from it.`,
      unknown: 'Field holds could not be checked right now, so a field may be on hold without showing here.',
      retry: 'Try again',
    },
  },
  es: {
    sanitizerCheck: {
      pass: (range) => `Dentro del rango de la etiqueta (${range}).`,
      too_low: (range) => `Demasiado baja. La etiqueta indica ${range}.`,
      too_high: (range) => `Demasiado alta. La etiqueta indica ${range}.`,
      no_label: 'Todavía no hay una etiqueta aprobada para este desinfectante, así que no se puede revisar la concentración. Agrega su etiqueta en Etiquetas de Desinfectantes.',
      no_range: 'La etiqueta de este desinfectante no indica un rango de concentración, así que no se puede revisar.',
      checking: 'Revisando las etiquetas de desinfectantes…',
      automatic: 'Llenado a partir de la etiqueta.',
      range: {
        between: (min, max) => `de ${min} a ${max} ppm`,
        atLeast: (min) => `al menos ${min} ppm`,
        upTo: (max) => `hasta ${max} ppm`,
      },
    },
    holds: {
      title: 'Campos en retención',
      intro: 'No coseches en estos campos ni les pongas código de lote a sus productos hasta que una acción correctiva levante la retención.',
      since: (date) => (date ? `En retención desde ${date}` : 'En retención'),
      reason: { crop_contact: 'El agua, la ceniza o los escombros llegaron al cultivo', animal_signs: 'Se encontraron señales de animales' },
      clear: 'Registrar acción correctiva',
      badge: 'En retención',
      harvestWarning: (field) => `${field} está en retención. Registra la acción correctiva que la levanta antes de cosechar ahí.`,
      unknown: 'Ahora no se pudieron revisar las retenciones de campo, así que un campo podría estar en retención sin aparecer aquí.',
      retry: 'Intentar de nuevo',
    },
  },
};
