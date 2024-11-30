import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import GetRequestByServer from "../Utils/GetRequestByServer"
import TaskItem from "../Components/TaskItem"

import {
    Segment,
    Header
 } from "semantic-ui-react"

const TaskGroupByLoaderContainer = ({
	socketFileNameSelected,
    taskIdSelected,
    onSelectTask,
    HTTPServerManager
}:any) => {

	const [instanceTaskListSelected, setInstanceTaskListSelected] = useState([])
    const [groupedInstanceTasks, setGroupedInstanceTasks] = useState({})

	useEffect(() => {

		if(socketFileNameSelected)
			fetchInstanceTasks()
		
	}, [socketFileNameSelected])

    
    useEffect(() => _UpdateTaskGrouping(), [instanceTaskListSelected])

    const _UpdateTaskGrouping = () => {
        const groupedTasks = instanceTaskListSelected
            .reduce((acc, task) => {
                if(acc[task.objectLoaderType])
                    acc[task.objectLoaderType].push(task)
                else 
                    acc[task.objectLoaderType] = [task]
                return acc
            }, {})

        setGroupedInstanceTasks(groupedTasks)
    }

	const _GetWebservice = GetRequestByServer(HTTPServerManager)
	
	const fetchInstanceTasks = () => 
		_GetWebservice(process.env.SERVER_APP_NAME, "Supervisor")
			.ListInstanceTasks({ socketFilename:socketFileNameSelected})
			.then(({data}:any) => setInstanceTaskListSelected(data))

	return <>                
                {
                    Object.keys(groupedInstanceTasks)
                        .map((objectLoaderType) =>  <>
                            <Header as='h3' dividing>{objectLoaderType} ({groupedInstanceTasks[objectLoaderType].length})</Header>
                            <Segment style={{background: "#f6f7f8"}}>
                            {
                                    groupedInstanceTasks[objectLoaderType]
                                    .map((task, index) =>
                                        <TaskItem 
                                            key={index} 
                                            taskIdSelected={taskIdSelected}
                                            task={task}
                                            showObjectLoaderType={false}
                                            onShowTaskDetails={taskId => onSelectTask(taskId)}/>)
                                }
                            </Segment>
                        </>)
                    }
            </>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager
})

export default connect(mapStateToProps, mapDispatchToProps)(TaskGroupByLoaderContainer)