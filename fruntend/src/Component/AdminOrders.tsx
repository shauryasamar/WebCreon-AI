const mockOrders = [
  {
    id: "ORD-1001",
    customer: "Aarav Mehta",
    total: 2398,
    status: "Processing",
    date: "2026-07-14",
  },
  {
    id: "ORD-1002",
    customer: "Neha Sharma",
    total: 1199,
    status: "Shipped",
    date: "2026-07-13",
  },
  {
    id: "ORD-1003",
    customer: "Rohan Verma",
    total: 3297,
    status: "Delivered",
    date: "2026-07-11",
  },
];

const AdminOrders = () => {
  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Orders</h1>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(255,255,255,0.05)" }}>
            <tr>
              <th style={thStyle}>Order ID</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {mockOrders.map((order) => (
              <tr key={order.id}>
                <td style={tdStyle}>{order.id}</td>
                <td style={tdStyle}>{order.customer}</td>
                <td style={tdStyle}>₹{order.total}</td>
                <td style={tdStyle}>{order.status}</td>
                <td style={tdStyle}>{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "13px",
  color: "rgba(255,255,255,0.7)",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  fontSize: "14px",
};

export default AdminOrders;