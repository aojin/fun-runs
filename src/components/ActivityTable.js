// src/components/ActivityTable.js

import React, { useMemo } from "react"
import { useTable } from "react-table"
import "./ActivityDashboard.css" // Import the CSS for table styling

const ActivityTable = ({
  activities,
  unitSystem,
  toggleUnitSystem,
  loadMoreActivities,
  hasMore,
  loading,
  jumpToActivity,
}) => {
  // Define table columns
  const columns = useMemo(
    () => [
      {
        Header: "Date",
        accessor: "date",
        className: "fixed-column left",
      },
      {
        Header: "Name",
        accessor: "name",
        className: "fixed-column left",
      },
      {
        Header: "Type",
        accessor: "type",
      },
      {
        Header: `Distance (${unitSystem === "metric" ? "km" : "mi"})`,
        accessor: activity =>
          unitSystem === "metric"
            ? (activity.distance / 1000).toFixed(2)
            : (activity.distance / 1609.34).toFixed(2),
      },
      {
        Header: `Moving Time (${unitSystem === "metric" ? "min" : "min"})`,
        accessor: activity => (activity.movingTime / 60).toFixed(2),
      },
      {
        Header: `Elapsed Time (${unitSystem === "metric" ? "min" : "min"})`,
        accessor: activity => (activity.elapsedTime / 60).toFixed(2),
      },
      {
        Header: `Total Elevation Gain (${
          unitSystem === "metric" ? "m" : "ft"
        })`,
        accessor: activity =>
          unitSystem === "metric"
            ? activity.totalElevationGain.toFixed(2)
            : (activity.totalElevationGain * 3.28084).toFixed(2),
      },
      {
        Header: "City",
        accessor: "city",
      },
      {
        Header: "State/Province",
        accessor: "state",
      },
      {
        Header: "Country",
        accessor: "country",
      },
      {
        Header: "Latitude",
        accessor: "startLat",
      },
      {
        Header: "Longitude",
        accessor: "startLng",
      },
      {
        Header: "Actions",
        Cell: ({ row }) => (
          <button
            onClick={() =>
              jumpToActivity([row.original.startLng, row.original.startLat])
            }
          >
            Jump to Activity
          </button>
        ),
        className: "fixed-column right",
      },
    ],
    [unitSystem, jumpToActivity]
  )

  // Memoize table data
  const data = useMemo(() => activities, [activities])

  // React Table setup
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data })

  return (
    <div>
      <button onClick={toggleUnitSystem} style={{ margin: "10px" }}>
        Toggle to {unitSystem === "metric" ? "Imperial" : "Metric"}
      </button>
      {hasMore && !loading && (
        <button onClick={loadMoreActivities} style={{ margin: "10px" }}>
          Load More
        </button>
      )}
      {loading && <p>Loading...</p>}
      {!loading && activities.length > 0 && (
        <div className="table-container">
          <table
            {...getTableProps()}
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map(column => (
                    <th
                      {...column.getHeaderProps()}
                      className={column.className}
                      style={{ border: "1px solid black", padding: "8px" }}
                    >
                      {column.render("Header")}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {rows.map(row => {
                prepareRow(row)
                return (
                  <tr {...row.getRowProps()} className="table-row">
                    {row.cells.map(cell => (
                      <td
                        {...cell.getCellProps()}
                        className={cell.column.className}
                        style={{ border: "1px solid black", padding: "8px" }}
                      >
                        {cell.render("Cell")}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ActivityTable
