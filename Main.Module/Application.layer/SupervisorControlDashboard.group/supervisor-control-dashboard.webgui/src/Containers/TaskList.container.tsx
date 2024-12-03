import * as React             from "react"

import TaskItem from "../Components/TaskItem"

const TaskListContainer = ({
	instanceTaskListSelected,
    taskIdSelected,
    onSelectTask
}:any) => {
	return <>
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
            </>
}


export default TaskListContainer