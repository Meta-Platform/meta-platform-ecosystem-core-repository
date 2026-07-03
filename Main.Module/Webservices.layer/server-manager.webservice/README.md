# server-manager.webservice (HTTP Servers)

Web service que expõe a API **HTTPServers** (`src/APIs/HTTPServers.api.json`),
usada pelo `server-manager.service` / `server-manager.webapp` para criar e
gerenciar servidores HTTP.

## Execução

Não é executado de forma independente (`node index.js`). É montado em runtime
sobre um `@@/server-service` a partir do
[`metadata/endpoint-group.json`](./metadata/endpoint-group.json), sob o prefixo
**`/server-manager`**. Assim, as rotas abaixo são acessadas com esse prefixo — por
exemplo, `Status` fica em `GET /server-manager/status`.

## Serviços disponibilizados
- HTTP Servers
    - Create HTTP Server
    - Status
    - List HTTP Servers
    - Add Web Service
    - List Web Service
    - Add Static Files Dir
    - List Static FilesDir


## **HTTP Servers** [HTTPServers]

> Todas as rotas abaixo são montadas sob o prefixo `/server-manager`.

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