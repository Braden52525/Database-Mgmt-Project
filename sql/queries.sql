-- Query is used for login
SELECT l.LoginId, l.username, l.role,
       a.AdminId, a.FullName AS AdminName,
       p.PassengerId, p.FullName AS PassengerName
FROM Login l
LEFT JOIN Admin a ON l.LoginId = a.LoginId
LEFT JOIN Passenger p ON l.LoginId = p.LoginId
WHERE l.username = 'sample_user'
  AND l.password = 'sample_password';

-- Query retrieves flights leaving from New York to Los Angeles that have available seats and depart after a specified time.
SELECT 
    FlightId, FlightNumber, Origin, Destination, DepartureTime, ArrivalTime, SeatsAvailable
FROM 
    Flight
WHERE 
    Origin = 'New York' 
    AND Destination = 'Los Angeles'
    AND DepartureTime >= '2025-03-21 00:00:00'
    AND SeatsAvailable > 0;

-- Transaction: Insert a new ticket and decrement available seats.
BEGIN;

-- Step 1: Insert a new ticket (returning the ticket number)
-- Note: We now insert a ClassType (e.g., 'Economy') rather than a ClassId.
INSERT INTO Ticket (SeatNumber, FlightId, PassengerId, ClassType)
VALUES ('12A', 1, 2, 'Economy')
RETURNING TicketNumber;

-- Step 2: Update the flight's available seats
UPDATE Flight
SET SeatsAvailable = SeatsAvailable - 1
WHERE FlightId = 1
  AND SeatsAvailable > 0;

COMMIT;

-- Transaction: Cancel a ticket (delete ticket and update flight seats).
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

-- Log the payment details for a specific ticket.
INSERT INTO Payment (Amount, Status, PaymentMethod, PassengerId, TicketNumber)
VALUES (199.99, 'Completed', 'Credit Card', 5, 123);

-- Join Ticket, Flight, FlightClass, and Payment to show detailed booking information for a given passenger.
SELECT 
    t.TicketNumber,
    t.SeatNumber,
    f.FlightNumber,
    f.Origin,
    f.Destination,
    t.DateTime,
    fc.ClassType,
    p.Status AS PaymentStatus,
    p.Amount
FROM 
    Ticket t
JOIN 
    Flight f ON t.FlightId = f.FlightId
JOIN 
    FlightClass fc ON t.FlightId = fc.FlightId AND t.ClassType = fc.ClassType
LEFT JOIN 
    Payment p ON t.TicketNumber = p.TicketNumber
WHERE 
    t.PassengerId = 5;

-- List all flights where a particular admin (AdminId = 2) is responsible.
SELECT 
    FlightId, FlightNumber, Origin, Destination, DepartureTime, ArrivalTime
FROM 
    Flight
WHERE 
    AdminId = 2;

-- Return all class records associated with a specific flight (using the FlightClass table).
SELECT 
    ClassType, SeatsAvailable
FROM 
    FlightClass
WHERE 
    FlightId = 101;

-- Insert a record into the Passenger_Flight junction table to track a passenger's inquiry.
INSERT INTO Passenger_Flight (PassengerId, FlightId)
VALUES (5, 101);
