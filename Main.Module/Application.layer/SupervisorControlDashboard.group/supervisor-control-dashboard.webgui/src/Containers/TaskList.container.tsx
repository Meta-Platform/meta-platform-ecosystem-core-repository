import * as React             from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import TaskItem from "../Components/TaskItem"

import useFetchInstanceTaskList from "../Hooks/useFetchInstanceTaskList"

const TaskListContainer = ({
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

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager
})

export default connect(mapStateToProps, mapDispatchToProps)(TaskListContainer)