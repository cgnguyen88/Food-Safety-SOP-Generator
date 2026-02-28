/**
 * Spanish translations for SOP content.
 * Keyed by SOP id → property path.
 * Components fall back to the English sop-data.js value when a key is absent.
 */
export const SOP_ES = {
  1: {
    title: "Salud, Higiene y Capacitación del Trabajador",
    short: "Salud del Trabajador",
    desc: "Lavado de manos, reporte de enfermedades, uso de guantes, reglas de alimentación/bebida, uso de baños y registros de capacitación de trabajadores.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          reviewed_by: "Revisado Por",
          review_date: "Fecha de Próxima Revisión",
          version: "Número de Versión",
        },
      },
      handwash: {
        title: "Procedimientos de Lavado de Manos",
        fields: {
          hw_station_locations: "Ubicaciones de Estaciones de Lavado de Manos",
          hw_frequency: "Cuándo Deben Lavarse las Manos los Trabajadores",
          hw_supplies: "Suministros Proporcionados",
          hw_monitoring: "Monitoreo / Cumplimiento",
        },
      },
      illness: {
        title: "Política de Reporte de Enfermedades",
        fields: {
          illness_symptoms: "Síntomas que Requieren Retiro del Contacto con Productos",
          illness_report_to: "Reportar Enfermedad A",
          illness_return_criteria: "Criterios de Regreso al Trabajo",
          illness_form_location: "Ubicación del Formulario de Reporte de Enfermedad",
        },
      },
      ppe: {
        title: "Política de Guantes y Equipo de Protección Personal",
        fields: {
          glove_required_tasks: "Tareas que Requieren Guantes",
          glove_type: "Tipo / Especificación de Guantes",
          glove_change_freq: "Frecuencia de Cambio de Guantes",
          other_ppe: "Otro EPP Requerido",
        },
      },
      conduct: {
        title: "Alimentación, Bebida y Conducta Personal",
        fields: {
          eating_areas: "Áreas Designadas para Comer / Beber",
          tobacco_policy: "Política de Tabaco / Vapeo",
          jewelry_policy: "Política de Joyería / Artículos Personales",
          medication_policy: "Almacenamiento de Medicamentos",
        },
      },
      toilet: {
        title: "Instalaciones Sanitarias",
        fields: {
          toilet_location: "Ubicaciones de Instalaciones Sanitarias",
          toilet_ratio: "Relación Trabajadores-Baños",
          toilet_service_freq: "Frecuencia de Servicio / Limpieza",
          toilet_supplies: "Suministros Mantenidos",
        },
      },
      training: {
        title: "Programa de Capacitación",
        fields: {
          training_schedule: "Calendario de Capacitación",
          training_topics: "Temas de Capacitación Requeridos",
          training_provider: "Capacitación Proporcionada Por",
          training_record_location: "Registros de Capacitación Almacenados",
          training_language: "Idioma(s) en que se Imparte la Capacitación",
        },
      },
    },
    log: {
      title: "Registro de Capacitación de Trabajadores",
      cols: ["Fecha", "Nombre del Empleado", "Tema Cubierto", "Nombre del Instructor", "Firma del Instructor", "Firma del Empleado", "Notas"],
    },
  },

  2: {
    title: "Política para Visitantes y Contratistas",
    short: "Visitantes",
    desc: "Reglas para visitantes, cuadrillas de cosecha, contratistas de mantenimiento y proveedores de servicios, incluyendo registro de entrada y expectativas de higiene.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          review_date: "Fecha de Próxima Revisión",
        },
      },
      scope: {
        title: "Alcance de la Política",
        fields: {
          visitor_types: "Tipos de Visitantes Cubiertos",
          restricted_zones: "Zonas Restringidas (Acceso de Visitantes Prohibido)",
          access_contact: "Coordinador de Visitantes / Persona de Contacto",
        },
      },
      signin: {
        title: "Requisitos de Registro de Entrada",
        fields: {
          signin_location: "Ubicación de Hoja de Registro",
          signin_info: "Información Recopilada al Registrarse",
          signin_advance_notice: "Aviso Previo Requerido",
          escort_required: "¿Se Requiere Acompañante en Áreas de Campo / Producción?",
        },
      },
      hygiene: {
        title: "Requisitos de Higiene para Visitantes",
        fields: {
          hygiene_orientation: "Puntos de Orientación de Higiene",
          ppe_for_visitors: "EPP Proporcionado a Visitantes",
          illness_exclusion: "Política de Exclusión por Enfermedad para Visitantes",
          hygiene_form: "Formulario de Reconocimiento de Higiene para Visitantes",
        },
      },
      contractors: {
        title: "Requisitos Específicos para Contratistas",
        fields: {
          contractor_prescreen: "Requisitos de Pre-selección",
          contractor_supervision: "Supervisión Durante el Trabajo",
          contractor_records: "Registros de Actividad del Contratista",
          harvest_crew_req: "Requisitos Específicos para Cuadrilla de Cosecha",
        },
      },
    },
    log: {
      title: "Registro de Entrada de Visitantes / Contratistas",
      cols: ["Fecha", "Nombre", "Empresa / Afiliación", "Propósito de la Visita", "Hora de Entrada", "Hora de Salida", "Acompañante / Anfitrión", "Orientación de Higiene Dada", "Firma"],
    },
  },

  3: {
    title: "POE de Limpieza y Sanitización",
    short: "Limpieza y Sanitización",
    desc: "Qué se limpia, cuándo, cómo, por quién y pasos de verificación del sanitizante para herramientas, cajones y todas las superficies en contacto con alimentos.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          responsible_person: "Persona Responsable de la Limpieza",
        },
      },
      surfaces: {
        title: "Inventario de Superficies en Contacto con Alimentos",
        fields: {
          surface_list: "Lista de Todas las Superficies / Equipos en Contacto con Alimentos",
          non_contact_surfaces: "Superficies sin Contacto con Alimentos (que también requieren limpieza)",
        },
      },
      procedure: {
        title: "Procedimiento de Limpieza y Sanitización",
        fields: {
          cleaning_steps: "Procedimiento de Limpieza Paso a Paso",
          cleaning_freq: "Frecuencia de Limpieza por Tipo de Superficie",
          pre_op_check: "Procedimiento de Inspección Pre-Operación",
        },
      },
      sanitizer: {
        title: "Información del Sanitizante",
        fields: {
          sanitizer_type: "Tipo / Nombre del Producto Sanitizante",
          sanitizer_concentration: "Concentración de Uso",
          contact_time: "Tiempo de Contacto Requerido",
          test_strip_type: "Tiras Reactivas / Método de Verificación",
          test_freq: "Frecuencia de Verificación de Concentración",
          sds_location: "Ubicación de la Hoja de Datos de Seguridad (SDS)",
          sanitizer_storage: "Ubicación y Condiciones de Almacenamiento del Sanitizante",
          corrective_action_fail: "Acción Correctiva si la Concentración Falla",
        },
      },
    },
    log: {
      title: "Registro de Limpieza y Sanitización",
      cols: ["Fecha", "Artículo / Superficie Limpiada", "Limpiado Por", "Método de Limpieza", "Producto Sanitizante", "Concentración", "Resultado Tira Reactiva", "Aprobado/Fallido", "Acción Correctiva", "Iniciales"],
    },
  },

  4: {
    title: "Evaluación del Agua Agrícola Pre-Cosecha",
    short: "Evaluación de Agua",
    desc: "Descripción de la fuente de agua, evaluación de riesgos, acciones correctivas y frecuencia de revisión según la regla de agua agrícola pre-cosecha actualizada de la FDA.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          assessment_date: "Fecha de Evaluación",
          assessor_name: "Nombre / Título del Evaluador",
          next_review: "Fecha de Próxima Revisión",
        },
      },
      source: {
        title: "Descripción de la Fuente de Agua",
        fields: {
          water_source_type: "Tipo de Fuente de Agua",
          water_use_type: "Tipo de Uso del Agua Agrícola",
          source_description: "Descripción Detallada de la Fuente",
          crops_irrigated: "Cultivos / Campos Atendidos",
        },
      },
      risk: {
        title: "Evaluación de Riesgos",
        fields: {
          upstream_risks: "Riesgos de Uso del Suelo Aguas Arriba / Adyacente",
          historical_issues: "Problemas o Preocupaciones Históricas de Contaminación",
          infrastructure_risks: "Riesgos de Infraestructura / Distribución",
          risk_level: "Nivel de Riesgo General",
          risk_justification: "Justificación del Nivel de Riesgo",
        },
      },
      controls: {
        title: "Gestión de Riesgos y Acciones Correctivas",
        fields: {
          current_controls: "Medidas de Control Actuales",
          corrective_actions_plan: "Acciones Correctivas si se Identifican Problemas",
          contingency_source: "Fuente de Agua Alternativa / de Emergencia",
        },
      },
      review: {
        title: "Revisión de la Evaluación",
        fields: {
          review_frequency: "Frecuencia de Revisión de la Evaluación",
          trigger_events: "Eventos que Desencadenan una Reevaluación Inmediata",
          assessor_training: "Capacitación / Calificaciones del Evaluador",
        },
      },
    },
    log: {
      title: "Registro de Revisión de Evaluación del Agua",
      cols: ["Fecha", "Evaluador", "Motivo de Revisión", "Hallazgos / Cambios Observados", "¿Cambio en Nivel de Riesgo?", "Acciones Tomadas", "Firma"],
    },
  },

  5: {
    title: "POE de Pruebas y Muestreo de Agua",
    short: "Pruebas de Agua",
    desc: "Ubicación de muestreo, método, cadena de custodia, laboratorio utilizado, frecuencia y registros para pruebas de agua agrícola.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          testing_applicable: "¿Son Actualmente Requeridas las Pruebas de Agua para Esta Granja?",
        },
      },
      sampling: {
        title: "Protocolo de Muestreo",
        fields: {
          sampling_locations: "Ubicaciones de los Puntos de Muestreo",
          sampling_method: "Método de Recolección de Muestras",
          sample_volume: "Volumen de Muestra Requerido",
          sampling_frequency: "Frecuencia de Pruebas",
          who_samples: "Persona Responsable del Muestreo",
        },
      },
      coc: {
        title: "Cadena de Custodia y Laboratorio",
        fields: {
          lab_name: "Nombre del Laboratorio de Pruebas",
          lab_contact: "Contacto y Dirección del Laboratorio",
          lab_certification: "Certificación / Acreditación del Laboratorio",
          coc_procedure: "Procedimiento de Cadena de Custodia",
          holding_time: "Tiempo Máximo de Retención de la Muestra",
          parameters_tested: "Parámetros Analizados",
        },
      },
      results: {
        title: "Gestión de Resultados",
        fields: {
          acceptable_limits: "Límites Aceptables",
          action_on_exceedance: "Acción si los Resultados Superan los Límites",
          record_location: "Ubicación de Registros de Resultados de Pruebas",
          retention_period: "Período de Retención de Registros",
        },
      },
    },
    log: {
      title: "Registro de Pruebas y Muestreo de Agua",
      cols: ["Fecha de Muestra", "Ubicación de Muestra", "Muestreado Por", "ID de Muestra", "Fecha de Recepción en Lab.", "Parámetro de Prueba", "Resultado (UFC/100mL)", "Límite", "Aprobado/Fallido", "Acción Correctiva", "Notas"],
    },
  },

  6: {
    title: "POE de Enmiendas Biológicas del Suelo",
    short: "Enmiendas del Suelo",
    desc: "Cómo se obtienen, manejan, almacenan y aplican los insumos de estiércol y compost, con registros de compra y aplicación.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
        },
      },
      types: {
        title: "Tipos de Enmiendas del Suelo Utilizadas",
        fields: {
          amendment_types_used: "Tipos de Enmiendas Biológicas del Suelo Utilizadas",
          amendment_sources: "Proveedores / Fuentes",
        },
      },
      treatment: {
        title: "Verificación de Tratamiento",
        fields: {
          compost_standards: "Estándares para Enmiendas Tratadas/Compostadas",
          treatment_records: "Registros de Tratamiento Obtenidos del Proveedor",
          pathogen_testing: "Pruebas de Patógenos en Enmiendas",
        },
      },
      handling: {
        title: "Almacenamiento y Manejo",
        fields: {
          storage_location: "Ubicación de Almacenamiento",
          storage_conditions: "Condiciones y Controles de Almacenamiento",
          handling_procedure: "Procedimientos de Manejo",
        },
      },
      application: {
        title: "Procedimientos de Aplicación",
        fields: {
          application_method: "Método de Aplicación",
          application_timing: "Momento / Intervalos de Aplicación",
          setback_distances: "Distancias de Separación Mantenidas",
          application_rate: "Tasa de Aplicación",
        },
      },
    },
    log: {
      title: "Registro de Aplicación de Enmiendas del Suelo",
      cols: ["Fecha", "Tipo de Enmienda", "Fuente / Proveedor", "Lote #", "Cantidad Aplicada", "Campo / Bloque", "Método de Aplicación", "Aplicado Por", "Intervalo Pre-Cosecha", "Fecha de Autorización", "Notas"],
    },
  },

  7: {
    title: "Intrusión Animal y Monitoreo de Vida Silvestre",
    short: "Vida Silvestre",
    desc: "Evaluación pre-cosecha del campo, señales de intrusión, zonas sin cosecha, documentación para manejo de vida silvestre y animales domésticos.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          assessor_name: "Evaluador(es) de Campo Designado(s)",
        },
      },
      monitoring: {
        title: "Programa de Monitoreo",
        fields: {
          monitoring_timing: "Cuándo se Realizan las Evaluaciones",
          monitoring_method: "Método de Evaluación",
          wildlife_types: "Vida Silvestre de Preocupación en Esta Ubicación",
          seasonal_risks: "Temporadas / Condiciones de Alto Riesgo",
        },
      },
      intrusion_signs: {
        title: "Indicadores de Intrusión",
        fields: {
          intrusion_signs: "Señales que Activan el Protocolo de No-Cosecha",
          no_harvest_zone: "Definición de Zona Sin Cosecha",
        },
      },
      prevention: {
        title: "Medidas Preventivas",
        fields: {
          exclusion_methods: "Métodos de Exclusión Física / Disuasión Utilizados",
          buffer_management: "Gestión de Zona de Amortiguamiento / Borde del Campo",
        },
      },
      response: {
        title: "Procedimientos de Respuesta",
        fields: {
          intrusion_response: "Pasos cuando se Encuentra una Intrusión",
          harvest_decision: "Autoridad para Decisión de Cosecha",
          disposal_procedure: "Disposición de Produce Contaminada / Descarte",
        },
      },
    },
    log: {
      title: "Registro de Evaluación Pre-Cosecha del Campo",
      cols: ["Fecha", "Campo / Bloque", "Cultivo", "Nombre del Evaluador", "Hora de Evaluación", "¿Evidencia Encontrada? (S/N)", "Descripción del Hallazgo", "¿Zona Sin Cosecha Establecida?", "Descripción de la Zona", "¿Cosecha Procedió? (S/N)", "Aprobación del Supervisor"],
    },
  },

  8: {
    title: "POE de Cosecha y Manejo Post-Cosecha",
    short: "Cosecha y Manejo",
    desc: "Condición de herramientas y cajones de cosecha, prácticas de manejo, gestión de descarte, respuesta a contaminación e inspecciones pre-operación diarias.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          harvest_supervisor: "Supervisor de Cosecha / Persona Responsable",
        },
      },
      preop: {
        title: "Inspección Pre-Operación Diaria",
        fields: {
          preop_timing: "Cuándo Ocurre la Inspección Pre-Operación",
          preop_checklist: "Elementos de la Inspección Pre-Operación",
          preop_authority: "Quién Realiza la Inspección Pre-Operación",
          preop_fail_action: "Acción si la Pre-Operación Falla",
        },
      },
      tools_containers: {
        title: "Gestión de Herramientas y Contenedores",
        fields: {
          tool_inspection_criteria: "Criterios de Aceptación / Rechazo de Herramientas",
          container_criteria: "Criterios de Aceptación de Contenedores / Cajones",
          damaged_container_action: "Acción para Contenedores Dañados / Contaminados",
          dedicated_equipment: "Designación de Equipo para Alimentos vs. No-Alimentos",
        },
      },
      handling: {
        title: "Prácticas de Manejo",
        fields: {
          hygiene_during_harvest: "Higiene del Trabajador Durante la Cosecha",
          produce_protection: "Medidas de Protección del Producto",
          temperature_control: "Requisitos de Control de Temperatura",
          postharvest_water: "Agua de Lavado / Enfriamiento Post-Cosecha",
        },
      },
      culls: {
        title: "Gestión de Descarte y Respuesta a Contaminación",
        fields: {
          cull_procedure: "Procedimiento de Gestión de Descarte",
          contamination_response: "Protocolo de Respuesta a Evento de Contaminación",
          foreign_material: "Control de Material Extraño",
        },
      },
    },
    log: {
      title: "Registro de Inspección Pre-Operación Diaria",
      cols: ["Fecha", "Turno / Cultivo", "Nombre del Inspector", "Cajones/Contenedores (Apr/Fal)", "Herramientas (Apr/Fal)", "Higiene del Trabajador (Apr/Fal)", "Condiciones del Campo (Apr/Fal)", "Agua (Apr/Fal)", "Resultado General", "Problemas Observados", "Acciones Correctivas", "Aprobación"],
    },
  },

  9: {
    title: "Trazabilidad y Codificación de Lotes / Preparación para Retiro",
    short: "Trazabilidad",
    desc: "Método de codificación de lotes, registros de envío y clientes, y proceso de simulacro de retiro para preparación en auditorías e incidentes.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          recall_coordinator: "Coordinador de Retiro (Contacto Principal)",
          recall_backup: "Coordinador de Retiro Suplente",
        },
      },
      lot_coding: {
        title: "Sistema de Codificación de Lotes",
        fields: {
          lot_code_method: "Descripción del Sistema de Código de Lote",
          lot_code_format: "Ejemplo de Formato de Código de Lote",
          lot_code_placement: "Dónde Aparece el Código de Lote en el Producto",
          smallest_traceable_unit: "Unidad Trazable Más Pequeña",
          lot_code_records_kept: "Registros que Vinculan el Código de Lote con la Fuente",
        },
      },
      shipping: {
        title: "Registros de Envíos y Clientes",
        fields: {
          customer_record_content: "Información Capturada en Registros de Envío",
          record_system: "Sistema de Mantenimiento de Registros Utilizado",
          record_retention: "Período de Retención de Registros",
          record_location: "Ubicación / Acceso a Registros",
        },
      },
      recall: {
        title: "Simulacro de Retiro y Respuesta al Retiro",
        fields: {
          mock_recall_frequency: "Frecuencia de Simulacro de Retiro",
          last_mock_recall: "Fecha del Último Ejercicio de Simulacro de Retiro",
          recall_trigger: "Eventos que Desencadenan un Retiro Real",
          recall_steps: "Pasos de Inicio del Retiro",
          recall_24hr_goal: "Meta de Tiempo de Rastreo Retroactivo / Prospectivo",
          regulatory_contacts: "Contactos Regulatorios",
        },
      },
    },
    log: {
      title: "Registro de Envío / Trazabilidad",
      cols: ["Fecha de Cosecha", "Código de Lote", "Cultivo / Producto", "Cantidad / Peso", "Fecha de Empaque", "Nombre del Cliente", "Dirección del Cliente", "Fecha de Entrega", "Factura #", "Recibido Por", "Notas"],
    },
  },

  10: {
    title: "Acción Correctiva y Respuesta a Incidentes",
    short: "Acción Correctiva",
    desc: "Qué hacer cuando se sospecha contaminación — vidrio roto, desbordamiento de aguas residuales, trabajador enfermo, falla de sanitizante o problema de agua.",
    sections: {
      meta: {
        title: "Información del Documento",
        fields: {
          farm_name: "Nombre de la Granja",
          effective_date: "Fecha de Vigencia",
          prepared_by: "Preparado Por",
          primary_contact: "Responsable Principal de Decisiones en Incidentes",
        },
      },
      scenarios: {
        title: "Escenarios de Incidentes Cubiertos",
        fields: {
          contamination_scenarios: "Tipos de Incidentes que Cubre Este POE",
        },
      },
      immediate: {
        title: "Protocolo de Respuesta Inmediata",
        fields: {
          stop_work_criteria: "Criterios de Parar el Trabajo / Parar la Cosecha",
          immediate_steps: "Pasos de Respuesta Inmediata (Primeros 30 Minutos)",
          notification_contacts: "Cadena de Notificación",
        },
      },
      investigation: {
        title: "Investigación y Causa Raíz",
        fields: {
          investigation_steps: "Procedimiento de Investigación",
          root_cause_analysis: "Método de Análisis de Causa Raíz",
        },
      },
    },
    log: {
      title: "Registro de Acciones Correctivas e Incidentes",
      cols: ["Fecha", "Tipo de Incidente", "Reportado Por", "Área Afectada", "Producto Afectado", "Cantidad", "Acción Inmediata Tomada", "Causa Raíz Identificada", "Acción Correctiva", "Verificado Por", "Fecha de Resolución", "Notas"],
    },
  },
};

/**
 * Look up a Spanish translation for SOP content.
 * Falls back to `null` when the key doesn't exist (caller uses English original).
 */
export function sopT(lang, sopId, ...path) {
  if (lang === "en") return null;
  let val = SOP_ES[sopId];
  for (const key of path) {
    if (val == null) return null;
    val = val[key];
  }
  return val ?? null;
}

/**
 * Return a localized SOP object (shallow-merging title/short/desc/sections/log).
 * Structural data (field ids, types, required, options, ph) stays English.
 */
export function getLocalizedSop(sop, lang) {
  if (lang === "en") return sop;
  const es = SOP_ES[sop.id];
  if (!es) return sop;

  return {
    ...sop,
    title: es.title || sop.title,
    short: es.short || sop.short,
    desc: es.desc || sop.desc,
    sections: sop.sections.map(section => {
      const esSection = es.sections?.[section.id];
      return {
        ...section,
        title: esSection?.title || section.title,
        fields: section.fields.map(field => ({
          ...field,
          label: esSection?.fields?.[field.id] || field.label,
        })),
      };
    }),
    log: {
      title: es.log?.title || sop.log.title,
      cols: es.log?.cols || sop.log.cols,
    },
  };
}
