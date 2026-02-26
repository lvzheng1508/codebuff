export interface LocalEndpoint {
  name: string
  base_url: string
  api_key?: string
  model?: string
}

export interface AgentModelBinding {
  agent_id: string
  endpoint: string
  model?: string
}

export interface LocalCliConfig {
  mode: 'local' | 'cloud'
  default_endpoint?: string
  endpoints: LocalEndpoint[]
  agent_bindings?: AgentModelBinding[]
}
