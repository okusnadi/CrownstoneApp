interface keepAlivePayload {
  stone: any,
  attempts: number,
  cleanup(): void,
  promise:{
    resolve(any?) : void,
    reject(any?)  : void,
    pending: boolean
  }
}

interface keepAliveStatePayload {
  handle: string,
  stone: any,
  crownstoneId: string,
  changeState: boolean,
  state: number,
  timeout: number,
  attempts: number,
  cleanup(): void,
  promise:{
    resolve(any?) : void,
    reject(any?)  : void,
    pending: boolean
  }
}

interface multiSwitchPayload {
  handle: string,
  stone: any,
  crownstoneId: string,
  state: number,
  intent: number,
  timeout: number,
  attempts: number,
  cleanup(): void,
  promise:{
    resolve(any?) : void,
    reject(any?)  : void,
    pending: boolean
  }
}

// key is sphereId
interface sphereMeshNetworks  {
  [propName: string] : meshNetworks
}

// key is meshNetwork
interface meshNetworks  {
  [propName: number] : meshTodo
}

interface connectionInfo  {
  sphereId : string,
  stoneId: string,
  stone: any,
  meshNetworkId?: string,
  handle : string,
}

interface meshTodo {
  keepAlive:      keepAlivePayload[],
  keepAliveState: keepAliveStatePayload[],
  multiSwitch:    multiSwitchPayload[],
  other:          any[]
}

type commandInterface = { commandName: 'keepAlive' } |
  { commandName : 'keepAliveState', state : number, timeout : number, changeState : boolean } |
  { commandName : 'setSwitchState', state : number } |
  { commandName : 'multiSwitch', state : number, timeout : number, intent: number } |
  { commandName : 'getFirmwareVersion' } |
  { commandName : 'getHardwareVersion' } |
  { commandName : 'getErrors' } |
  { commandName : 'clearErrors', clearErrorJSON: any }


interface batchCommands  {
  [propName: string] : batchCommandEntry
}

// keys are sphereIds
interface directCommands  {
  [propName: string] : batchCommandEntry[]
}

interface batchCommandEntry {
  priority: boolean,
  handle:   string,
  sphereId: string,
  stoneId:  string,
  stone:    any,
  attempts: number,
  command:  commandInterface,
  cleanup(): void,
  promise:{
    resolve(any?) : void,
    reject(any?) : void,
    pending: boolean,
  }
}
