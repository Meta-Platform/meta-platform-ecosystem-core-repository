import styled from "styled-components"
import * as React from "react"
import { Segment, Loader, Dimmer } from "semantic-ui-react"

const GridContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
  justify-content: flex-start;
`

const FlexibleSegment = styled(Segment)`
  flex: 0 0 auto;
  max-width: 400px;
  min-width: 200px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: auto;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.24);
  transition: all 0.3s ease-in-out;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 3px 3px rgba(0, 0, 0, 0.24);
  }
`

const PackageDataGrid = ({ packageList }) => 
  <GridContainer>
      {packageList.map((packageInformation) => (
        <FlexibleSegment key={packageInformation.packageName}>
          <h3 style={{ margin: "0 0 8px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {packageInformation.packageName}.{packageInformation.ext}
          </h3>
          <p style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <strong>{packageInformation.namespaceRepo}</strong>
            <i>{`.${packageInformation.moduleName}.${packageInformation.layerName}${packageInformation.parentGroup ? `.${packageInformation.parentGroup}` : ""}`}</i>
          </p>
        </FlexibleSegment>
      ))}
    </GridContainer>

const PackageList = ({ isLoading, packageList }) =>
  <Segment placeholder>
      {isLoading && (
        <Dimmer active>
          <Loader />
        </Dimmer>
      )}
      <PackageDataGrid packageList={packageList} />
    </Segment>

export default PackageList
