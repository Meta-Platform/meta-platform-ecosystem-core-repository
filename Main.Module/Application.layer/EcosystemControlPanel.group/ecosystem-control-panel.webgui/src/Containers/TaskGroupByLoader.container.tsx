import * as React             from "react"
import {useEffect, useState}  from "react"

import TaskItem from "../Components/TaskItem"

import {
    Segment,
    Header
 } from "semantic-ui-react"

const TaskGroupByLoaderContainer = ({
	instanceTaskList,
    taskId,
    onSelectTask
}:any) => {

    const [groupedInstanceTasks, setGroupedInstanceTasks] = useState({})

    useEffect(() => _UpdateTaskGrouping(), [instanceTaskList])

    const _UpdateTaskGrouping = () => {
        const groupedTasks = instanceTaskList
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
                                            taskId={taskId}
                                            task={task}
                                            showObjectLoaderType={false}
                                            onShowTaskDetails={taskId => onSelectTask(taskId)}/>)
                                }
                            </Segment>
                        </>)
                    }
            </>
}

export default TaskGroupByLoaderContainer