import * as React             from "react"
import {useEffect, useState}  from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import TaskItem from "../Components/TaskItem"
import useFetchInstanceTaskList from "../Hooks/useFetchInstanceTaskList"

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

	const instanceTaskListSelected = 
        useFetchInstanceTaskList({
            socketFileNameSelected,
            HTTPServerManager
        })

    const [groupedInstanceTasks, setGroupedInstanceTasks] = useState({})

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