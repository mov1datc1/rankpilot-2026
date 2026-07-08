## Descripción general
Este módulo proporciona la función `run_rankpilot`, que sirve como punto de entrada principal para el Sistema Multi-Agente RankPilot. Maneja dos modos de flujo de trabajo distintos: ingestión inicial de documentos (a través de ruta de archivo) y turnos conversacionales posteriores (a través de mensajes del usuario). La función gestiona la persistencia de estado utilizando identificadores de hilo (simulando IDs de sesión de Laravel) e interactúa con una aplicación de LangGraph con estado (`app`) para coordinar el procesamiento multi-agente.

## Clases
*(No se definen clases en este archivo)*

## Funciones y Métodos
| Nombre | Parámetros | Responsabilidad |
|--------|------------|-----------------|
| run_rankpilot | user_input: str, thread_id: str, is_file: bool = False | Envoltorio de ejecución principal para el Sistema Multi-Agente RankPilot. Determina el modo de flujo de trabajo según la bandera `is_file`: si es True, inicia un nuevo caso mediante la ingestión de una ruta de archivo; si es False, reanuda un caso existente con un mensaje del usuario. Utiliza `thread_id` para la persistencia de estado entre llamadas y devuelve el estado final de la ejecución del grafo. Gestiona el registro de las transiciones del flujo de trabajo. |