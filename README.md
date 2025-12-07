# Final-React-Native-Assingment
## GitHub Copilot Reflection

For this final project, I used GitHub Copilot to help me add a pie chart to my existing Student Expense Tracker built in React Native. Copilot helped with generating the initial PieChart component using the `react-native-chart-kit` library and mapping my expense totals to chart data.

### Suggestion Copilot Gave that I Changed
Copilot initially suggested using hardcoded sample values for the chart. I changed this so the chart uses real totals computed from my SQLite database. This lets the chart update automatically when expenses are added or filtered.

### Where Copilot Saved Time
Copilot saved time by generating boilerplate code for chartConfig, data mapping logic, and the JSX structure of the `PieChart`. This allowed me to focus on connecting the chart to my actual app state.
