## Descripción general
Este archivo define la función `create_rankpilot_graph`, que construye y compila una máquina de estados de LangGraph para un pipeline de procesamiento de documentos. El grafo orquesta una secuencia de nodos de agente con un bucle dialéctico persistente, restringiendo la generación del informe final tras un umbral del 65% de confianza estructural.

## Clases
- Ninguno (sin definiciones de clase en este archivo; solo importaciones y definiciones de funciones)

## Funciones y métodos
| Nombre | Parámetros | Responsabilidad |
|------|------------|----------------|
| create_rankpilot_graph | Ninguno | Construye la máquina de estados de LangGraph agregando nodos, definiendo una secuencia de entrada fija, implementando enrutamiento condicional basado en confianza, configurando un bucle de retorno y compilando con un MemorySaver checkpointer. |
| route_based_on_confidence | state: AgentState | Enrutador interno que examina `confidence_score` en el estado y devuelve `"writing"` (si la puntuación ≥ 65) o `"interrogation"` (si la puntuación < 65) para controlar el flujo del grafo. |