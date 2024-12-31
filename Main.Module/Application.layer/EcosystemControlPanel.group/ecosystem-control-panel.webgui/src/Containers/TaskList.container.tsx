import * as React             from "react"

import TaskItem from "../Components/TaskItem"

const TaskListContainer = ({
	instanceTaskList,
    taskId,
    onSelectTask
}:any) => {
	return <>
                { 
                    instanceTaskList 
                    && <div style={{ overflow: 'auto', maxHeight:"87vh" }}>
                            {
                                instanceTaskList
                                .map((task, index) =>
                                    <TaskItem 
                                        key={index} 
                                        taskId={taskId}
                                        task={task}
                                        onShowTaskDetails={taskId => onSelectTask(taskId)}/>)
                            }
                        </div>
                }
            </>
}


export default TaskListContainer