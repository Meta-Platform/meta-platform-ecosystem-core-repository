import * as React from "react"
import { 
	Grid,
	TabPane, 
	Tab
 } from "semantic-ui-react"

import TaskListContainer from "../../Containers/TaskList.container"
import TaskGroupByLoaderContainer from "../../Containers/TaskGroupByLoader.container"

import TaskInformation from "../../Components/TaskInformation"

const Column = Grid.Column

import TaskCardGroup from "./Task.cardGroup"

const Tasks = ({
    taskId,
    instanceTaskList,
    taskInformation,
    onSelectTask
}) => {
	const taskViewPanes = [
		{
			menuItem: 'group by loader', render: () => 
			<TabPane>
				<TaskGroupByLoaderContainer
					instanceTaskList={instanceTaskList}
					taskId={taskId}
					onSelectTask={onSelectTask}/>
			</TabPane>
		},
		{
			menuItem: 'list by id', render: () => 
			<TabPane style={{background: "#f6f7f8"}}>
				<TaskListContainer
					instanceTaskList={instanceTaskList}
					taskId={taskId}
					onSelectTask={onSelectTask}/>
			</TabPane>
		},
		{
			menuItem: 'group by hierarchy', render: () => 
			<TabPane style={{background: "#f6f7f8"}}>
				group by hierarchy
			</TabPane>
		},
		{
			menuItem: 'diagram', render: () => 
			<TabPane>
				diagram
			</TabPane>
		}

	]

    return <Grid columns="three" style={{background: "aliceblue"}} divided>
                <Column width={taskId === undefined ? 16 : 11}>
                    <TaskCardGroup tasklist={instanceTaskList}/>
                    <Tab menu={{ color: "aliceblue" , secondary: true, pointing: true }} panes={taskViewPanes} />
                </Column>
                {
                    taskId !== undefined
                    && <Column width={5}>
                        {
                            taskInformation
                            && <TaskInformation taskInformation={taskInformation}/>
                        }
                    </Column>
                }
            </Grid>
}

export default Tasks