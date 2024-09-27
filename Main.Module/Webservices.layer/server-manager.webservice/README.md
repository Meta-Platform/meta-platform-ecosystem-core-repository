# Módulo Web HTTP Servers
Módulo de serviços web da aplicação server-manager.webapp

## Primeiros Passos
O Módulo Web HTTP Servers pode ser executado de forma independente

### Instalação
```sh
$ npm install
````
### Execução
```sh
$ node index.js
````

## Serviços disponibilizados
- HTTP Servers
    - Create HTTP Server
    - Status
    - List HTTP Servers
    - Add Web Service
    - List Web Service
    - Add Static Files Dir
    - List Static FilesDir


## **Datasource Manager** [DataSources]
**Serviços**
- Create HTTP Server
- Status
- List HTTP Servers
- Add Web Service
- List Web Service
- Add Static Files Dir
- List Static FilesDir


### **Create HTTP Server** [CreateHTTPServer]
`POST` /http-server

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| name  | string  | body  | yes  |
| port  | number  | body  | yes  |


### **Status** [Status]
 `GET` /status


### **List HTTP Servers** [ListHTTPServers]
`GET` /http-server-manager


### **Add Web Service** [AddWebService]
`PUT` /http-server-manager/:name/web-services

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|


### **List Web Service** [ListWebService]
`GET` /http-server-manager/:name/web-services

### **Add Static Files Dir** [AddStaticFilesDir]
`PUT` /http-server-manager/:name/static-files-dir

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| name  | string  | path  | yes  |
| path  | string  | body  | yes  |


### **List Static Files Dir** [ListStaticFilesDir]
 `GET` /http-server-manager/:name/static-files-dir