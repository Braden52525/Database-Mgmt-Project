// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection settings – update these with your credentials
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Airline',
  password: 'Mareo123',
  port: 5432,
});

// Login endpoint (unchanged)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const queryText = `
      SELECT l.LoginId, l.username, l.role,
             a.AdminId, a.FullName AS AdminName,
             p.PassengerId, p.FullName AS PassengerName
      FROM Login l
      LEFT JOIN Admin a ON l.LoginId = a.LoginId
      LEFT JOIN Passenger p ON l.LoginId = p.LoginId
      WHERE l.username = $1 AND l.password = $2;
    `;
    const result = await pool.query(queryText, [username, password]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Registration endpoint (unchanged from earlier)
app.post('/api/register', async (req, res) => {
  const { username, password, fullName, email, phoneNumber, dateOfBirth, address } = req.body;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const loginQuery = `
        INSERT INTO Login (username, password, role)
        VALUES ($1, $2, 'Passenger')
        RETURNING LoginId
      `;
      const loginResult = await client.query(loginQuery, [username, password]);
      const loginId = loginResult.rows[0].loginid;
      const passengerQuery = `
        INSERT INTO Passenger (FullName, Email, PhoneNumber, DateOfBirth, Address, LoginId)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await client.query(passengerQuery, [fullName, email, phoneNumber, dateOfBirth, address, loginId]);
      await client.query('COMMIT');
      res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Transaction error during registration:', err);
      res.status(500).json({ error: 'Registration failed' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error connecting to DB for registration:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint: Get all available flights (unchanged)
app.get('/api/available-flights', async (req, res) => {
  try {
    const queryText = `
      SELECT FlightId, FlightNumber, Origin, Destination, DepartureTime, ArrivalTime, SeatsAvailable
      FROM Flight
      WHERE DepartureTime >= NOW() AND SeatsAvailable > 0
      ORDER BY DepartureTime;
    `;
    const result = await pool.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error('Error retrieving available flights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Booking endpoint rewritten to handle the process directly
app.post('/api/book', async (req, res) => {
  const { seatNumber, flightId, passengerId, classType, amount, status, paymentMethod } = req.body;
  
  // Debug logging
  console.log('Received booking request:', {
    seatNumber,
    flightId,
    passengerId,
    classType,
    amount,
    status,
    paymentMethod
  });
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Start transaction
    
    // Step 1: Check if seats are available
    const checkSeatsQuery = `
      SELECT SeatsAvailable 
      FROM FlightClass 
      WHERE FlightId = $1 AND ClassType = $2
      FOR UPDATE;
    `;
    console.log('Checking seats with:', { flightId, classType });
    const seatsResult = await client.query(checkSeatsQuery, [flightId, classType]);
    console.log('Seats result:', seatsResult.rows);
    
    if (seatsResult.rows.length === 0) {
      throw new Error(`Class ${classType} not found for flight ${flightId}`);
    }
    
    if (seatsResult.rows[0].seatsavailable <= 0) {
      throw new Error(`No seats available in ${classType} class for flight ${flightId}`);
    }
    
    // Step 2: Insert ticket
    const insertTicketQuery = `
      INSERT INTO Ticket (SeatNumber, FlightId, PassengerId, ClassType)
      VALUES ($1, $2, $3, $4)
      RETURNING TicketNumber;
    `;
    console.log('Inserting ticket with:', { seatNumber, flightId, passengerId, classType });
    const ticketResult = await client.query(insertTicketQuery, [
      seatNumber,
      flightId,
      passengerId,
      classType
    ]);
    console.log('Ticket result:', ticketResult.rows);
    
    const ticketNumber = ticketResult.rows[0].ticketnumber;
    
    // Step 3: Update available seats
    const updateSeatsQuery = `
      UPDATE FlightClass
      SET SeatsAvailable = SeatsAvailable - 1
      WHERE FlightId = $1 AND ClassType = $2;
    `;
    console.log('Updating seats with:', { flightId, classType });
    await client.query(updateSeatsQuery, [flightId, classType]);
    
    // Step 4: Process payment
    const insertPaymentQuery = `
      INSERT INTO Payment (Amount, Status, PaymentMethod, PassengerId, TicketNumber)
      VALUES ($1, $2, $3, $4, $5);
    `;
    console.log('Processing payment with:', { amount, status, paymentMethod, passengerId, ticketNumber });
    await client.query(insertPaymentQuery, [
      amount,
      status,
      paymentMethod,
      passengerId,
      ticketNumber
    ]);
    
    await client.query('COMMIT');
    res.json({ ticketNumber: ticketNumber });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error booking flight:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Cancellation endpoint remains the same (Ticket deletion still works via TicketNumber)
app.post('/api/cancel', async (req, res) => {
  const { ticketNumber, refundAmount, changedBy } = req.body;
  try {
    const queryText = `SELECT cancel_ticket($1, $2, $3);`;
    await pool.query(queryText, [ticketNumber, refundAmount, changedBy]);
    res.json({ message: 'Ticket cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling ticket:', error);
    res.status(500).json({ error: error.message });
  }
});
// Endpoint: Get all tickets for a specific passenger
app.get('/api/my-tickets/:passengerId', async (req, res) => {
  try {
    const passengerId = req.params.passengerId;
    const queryText = `
      SELECT 
          t.TicketNumber,
          t.SeatNumber,
          f.FlightNumber,
          f.Origin,
          f.Destination,
          t.DateTime,
          fc.ClassType,
          p.Status as PaymentStatus,
          p.Amount
      FROM Ticket t
      JOIN Flight f ON t.FlightId = f.FlightId
      JOIN FlightClass fc ON t.FlightId = fc.FlightId AND t.ClassType = fc.ClassType
      LEFT JOIN Payment p ON t.TicketNumber = p.TicketNumber
      WHERE t.PassengerId = $1
      ORDER BY t.DateTime DESC;
    `;
    const result = await pool.query(queryText, [passengerId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving tickets:", error);
    res.status(500).json({ error: "Server error" });
  }
});
app.get('/api/search-flights', async (req, res) => {
  try {
    const { origin, destination, date } = req.query;
    const queryText = `
      SELECT FlightId, FlightNumber, Origin, Destination, DepartureTime, ArrivalTime, SeatsAvailable
      FROM Flight
      WHERE Origin ILIKE $1 AND Destination ILIKE $2 AND DATE(DepartureTime) = $3 AND SeatsAvailable > 0
      ORDER BY DepartureTime;
    `;
    const result = await pool.query(queryText, [`%${origin}%`, `%${destination}%`, date]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error retrieving searched flights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/api/flight-classes/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;
    const queryText = `
      SELECT ClassType, SeatsAvailable
      FROM FlightClass
      WHERE FlightId = $1;
    `;
    const result = await pool.query(queryText, [flightId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error retrieving flight classes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint: Get all flights (for admin view)
app.get('/api/flights', async (req, res) => {
  try {
    const queryText = `
      SELECT 
        f.FlightId,
        f.FlightNumber,
        f.Origin,
        f.Destination,
        f.DepartureTime,
        f.ArrivalTime,
        f.SeatsAvailable,
        a.FullName as AdminName
      FROM Flight f
      LEFT JOIN Admin a ON f.AdminId = a.AdminId
      ORDER BY f.DepartureTime;
    `;
    const result = await pool.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error('Error retrieving all flights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint: Get passengers for a specific flight (for admin view)
app.get('/api/flight-passengers/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;
    const queryText = `
      SELECT 
        t.TicketNumber,
        t.SeatNumber,
        p.FullName as PassengerName,
        t.ClassType,
        t.DateTime,
        pay.Status as PaymentStatus,
        pay.Amount
      FROM Ticket t
      JOIN Passenger p ON t.PassengerId = p.PassengerId
      LEFT JOIN Payment pay ON t.TicketNumber = pay.TicketNumber
      WHERE t.FlightId = $1
      ORDER BY t.DateTime DESC;
    `;
    const result = await pool.query(queryText, [flightId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error retrieving flight passengers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint: Delete a flight
app.delete('/api/flights/:flightId', async (req, res) => {
  const { flightId } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // First, check if there are any tickets for this flight
    const checkTicketsQuery = `
      SELECT COUNT(*) as ticket_count
      FROM Ticket
      WHERE FlightId = $1;
    `;
    const ticketsResult = await client.query(checkTicketsQuery, [flightId]);
    
    if (ticketsResult.rows[0].ticket_count > 0) {
      throw new Error('Cannot delete flight: There are tickets booked for this flight');
    }
    
    // Delete flight classes first (due to foreign key constraint)
    const deleteClassesQuery = `
      DELETE FROM FlightClass
      WHERE FlightId = $1;
    `;
    await client.query(deleteClassesQuery, [flightId]);
    
    // Then delete the flight
    const deleteFlightQuery = `
      DELETE FROM Flight
      WHERE FlightId = $1;
    `;
    await client.query(deleteFlightQuery, [flightId]);
    
    await client.query('COMMIT');
    res.json({ message: 'Flight deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting flight:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Endpoint: Update flight times
app.put('/api/flights/:flightId', async (req, res) => {
  const { flightId } = req.params;
  const { departureTime, arrivalTime } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Validate that departure time is before arrival time
    if (new Date(departureTime) >= new Date(arrivalTime)) {
      throw new Error('Departure time must be before arrival time');
    }
    
    // Update flight times
    const updateFlightQuery = `
      UPDATE Flight
      SET DepartureTime = $1, ArrivalTime = $2
      WHERE FlightId = $3;
    `;
    await client.query(updateFlightQuery, [departureTime, arrivalTime, flightId]);
    
    await client.query('COMMIT');
    res.json({ message: 'Flight times updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating flight times:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Endpoint: Get taken seats for a flight and class
app.get('/api/taken-seats/:flightId/:classType', async (req, res) => {
  try {
    const { flightId, classType } = req.params;
    const queryText = `
      SELECT t.SeatNumber
      FROM Ticket t
      WHERE t.FlightId = $1 AND t.ClassType = $2;
    `;
    const result = await pool.query(queryText, [flightId, classType]);
    res.json(result.rows.map(row => row.seatnumber));
  } catch (error) {
    console.error('Error retrieving taken seats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
