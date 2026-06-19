import * as React from "react"
import { 
	Grid,
	TabPane, 
	Tab
 } from "semantic-ui-react"

import TaskGroupByLoaderContainer from "../../Containers/TaskGroupByLoader.container"

import TaskInformation from "../../Components/TaskInformation"

const Column = Grid.Column

import TaskCardGroup from "./Task.cardGroup"
import TaskProcessMonitor from "./TaskProcessMonitor"

const Tasks = ({
    taskId,
    instanceTaskList,
    taskInformation,
    onSelectTask
}) => {
	const taskViewPanes = [
		{
			menuItem: 'monitor', render: () =>
			<TabPane style={{background: "#f6f7f8"}}>
				<TaskProcessMonitor
					instanceTaskList={instanceTaskList}
					taskId={taskId}
					onSelectTask={onSelectTask}/>
			</TabPane>
		},
		{
			menuItem: 'group by loader', render: () =>
			<TabPane>
				<TaskGroupByLoaderContainer
					instanceTaskList={instanceTaskList}
					taskId={taskId}
					onSelectTask={onSelectTask}/>
			</TabPane>
		}

	]

    return <Grid columns="three" divided>
                <Column width={taskId === undefined ? 16 : 11}>
                    <TaskCardGroup tasklist={instanceTaskList}/>
                    <Tab menu={{ secondary: true, pointing: true }} panes={taskViewPanes} />
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