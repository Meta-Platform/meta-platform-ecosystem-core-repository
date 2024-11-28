import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { 
	Segment
 } from "semantic-ui-react"
import GetRequestByServer from "../Utils/GetRequestByServer"
import TaskItem from "../Components/TaskItem"

const TaskListContainer = ({
	socketFileNameSelected,
    taskIdSelected,
    onSelectTask,
    HTTPServerManager
}:any) => {

	const [instanceTaskListSelected, setInstanceTaskListSelected] = useState([])

	useEffect(() => {

		if(socketFileNameSelected)
			fetchInstanceTasks()
		
	}, [socketFileNameSelected])

	const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchInstanceTasks = () => 
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
			.ListInstanceTasks({ socketFilename:socketFileNameSelected})
			.then(({data}:any) => setInstanceTaskListSelected(data))

	return <Segment placeholder>
                { 
                    instanceTaskListSelected 
                    && <div style={{ overflow: 'auto', maxHeight:"87vh" }}>
                            {
                                instanceTaskListSelected
                                .map((task, index) =>
                                    <TaskItem 
                                        key={index} 
                                        taskIdSelected={taskIdSelected}
                                        task={task}
                                        onShowTaskDetails={taskId => onSelectTask(taskId)}/>)
                            }
                        </div>
                }
            </Segment>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager
})

export default connect(mapStateToProps, mapDispatchToProps)(TaskListContainer)