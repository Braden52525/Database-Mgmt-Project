--query is used for login
SELECT l.LoginId, l.username, l.role,
       a.AdminId, a.FullName AS AdminName,
       p.PassengerId, p.FullName AS PassengerName
FROM Login l
LEFT JOIN Admin a ON l.LoginId = a.LoginId
LEFT JOIN Passenger p ON l.LoginId = p.LoginId
WHERE l.username = 'sample_user'
  AND l.password = 'sample_password';


--query retrieves flights leaving from New York to Los Angeles that have available seats and depart after a specified time.
SELECT 
    FlightId, FlightNumber, Origin, Destination, DepartureTime, ArrivalTime, SeatsAvailable
FROM 
    Flight
WHERE 
    Origin = 'New York' 
    AND Destination = 'Los Angeles'
    AND DepartureTime >= '2025-03-21 00:00:00'
    AND SeatsAvailable > 0;

--The transaction ensures both operations (ticket insertion and seat decrement) happen together. 
--You might also want to add logic (or a stored procedure) that checks for available seats before inserting the ticket.
BEGIN;

-- Step 1: Insert a new ticket (returning the ticket number if needed)
INSERT INTO Ticket (SeatNumber, FlightId, PassengerId, ClassId)
VALUES ('12A', 1, 2, 1)
RETURNING TicketNumber;

-- Step 2: Update the flight's available seats
UPDATE Flight
SET SeatsAvailable = SeatsAvailable - 1
WHERE FlightId = 1
  AND SeatsAvailable > 0;

COMMIT;

-- This query uses a common table expression (CTE) to capture the FlightId from the deleted ticket record, then updates the corresponding Flight record.
BEGIN;

-- Step 1: Delete the ticket and get the associated FlightId
WITH removed_ticket AS (
    DELETE FROM Ticket 
    WHERE TicketNumber = 2
    RETURNING FlightId
)
-- Step 2: Update the flight to increment available seats for the canceled booking
UPDATE Flight
SET SeatsAvailable = SeatsAvailable + 1
WHERE FlightId = (SELECT FlightId FROM removed_ticket);

COMMIT;


--This query logs the payment details for a specific ticket. 
--In your design, each ticket should have one associated payment (hence the unique constraint on TicketNumber in Payment).
INSERT INTO Payment (Amount, Status, PaymentMethod, PassengerId, TicketNumber)
VALUES (199.99, 'Completed', 'Credit Card', 5, 123);

--This query joins the Ticket, Flight, Class, and Payment tables to show detailed booking information for a given passenger. 
--The LEFT JOIN on Payment ensures that ticket details appear even if payment information is not yet available.
SELECT 
    t.TicketNumber,
    t.SeatNumber,
    f.FlightNumber,
    f.Origin,
    f.Destination,
    t.DateTime,
    c.ClassType,
    p.Status AS PaymentStatus,
    p.Amount
FROM 
    Ticket t
JOIN 
    Flight f ON t.FlightId = f.FlightId
JOIN 
    Class c ON t.ClassId = c.ClassId
LEFT JOIN 
    Payment p ON t.TicketNumber = p.TicketNumber
WHERE 
    t.PassengerId = 5;


--This query lists all flights where a particular admin (AdminId = 2) is responsible.
SELECT 
    FlightId, FlightNumber, Origin, Destination, DepartureTime, ArrivalTime
FROM 
    Flight
WHERE 
    AdminId = 2;


--This query returns all class records associated with a specific flight.
SELECT 
    ClassId, ClassType
FROM 
    Class
WHERE 
    FlightId = 101;


--This keeps a history of which flights a passenger has viewed or expressed interest in.
INSERT INTO Passenger_Flight (PassengerId, FlightId)
VALUES (5, 101);
