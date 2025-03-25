DROP TABLE IF EXISTS Passenger_Flight;
DROP TABLE IF EXISTS Payment;
DROP TABLE IF EXISTS Ticket;
DROP TABLE IF EXISTS FlightClass;
DROP TABLE IF EXISTS Flight CASCADE;
DROP TABLE IF EXISTS Passenger;
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS Login;
DROP TABLE IF EXISTS AuditLog;

-- AuditLog table to record key operations on critical tables
CREATE TABLE AuditLog (
    AuditId SERIAL PRIMARY KEY,
    TableName VARCHAR(100) NOT NULL,
    Operation VARCHAR(50) NOT NULL,
    RecordId INT,
    ChangeTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ChangedBy VARCHAR(50)
);

-- Create the Login table
CREATE TABLE Login (
    LoginId SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL  -- Consider roles such as 'Admin' or 'Passenger'
);

-- Create the Admin table (One-to-One with Login)
CREATE TABLE Admin (
    AdminId SERIAL PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    LoginId INT UNIQUE NOT NULL REFERENCES Login(LoginId) ON DELETE CASCADE
);

-- Create the Passenger table (One-to-One with Login)
CREATE TABLE Passenger (
    PassengerId SERIAL PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    PhoneNumber VARCHAR(15),
    DateOfBirth DATE,
    Address VARCHAR(255),
    LoginId INT UNIQUE NOT NULL REFERENCES Login(LoginId) ON DELETE CASCADE
);

-- Create the Flight table (Managed by an Admin)
CREATE TABLE Flight (
    FlightId SERIAL PRIMARY KEY,
    DepartureTime TIMESTAMP NOT NULL,
    FlightNumber VARCHAR(10) NOT NULL,
    Distance INT,
    Origin VARCHAR(100) NOT NULL,
    SeatsAvailable INT NOT NULL,
    Destination VARCHAR(100) NOT NULL,
    ArrivalTime TIMESTAMP NOT NULL,
    AdminId INT REFERENCES Admin(AdminId) ON DELETE SET NULL
);
-- Create the Class table (Each flight can have multiple classes)
CREATE TABLE FlightClass (
    FlightId INT NOT NULL REFERENCES Flight(FlightId) ON DELETE CASCADE,
    ClassType VARCHAR(50) NOT NULL, -- e.g., 'Economy', 'Business', 'First Class'
    SeatsAvailable INT NOT NULL,
    PRIMARY KEY (FlightId, ClassType)
);

-- Create the Ticket table (Updated to reference Class instead of storing ClassType as text)
CREATE TABLE Ticket (
    TicketNumber SERIAL PRIMARY KEY,
    SeatNumber VARCHAR(10) NOT NULL,
    FlightId INT NOT NULL REFERENCES Flight(FlightId) ON DELETE CASCADE,
    PassengerId INT NOT NULL REFERENCES Passenger(PassengerId) ON DELETE CASCADE,
    ClassType VARCHAR(50) NOT NULL,
    DateTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_flightclass FOREIGN KEY (FlightId, ClassType)
        REFERENCES FlightClass(FlightId, ClassType)
);

-- Create the Payment table (Assuming one payment per ticket)
CREATE TABLE Payment (
    PaymentId SERIAL PRIMARY KEY,
    Amount DECIMAL(10, 2) NOT NULL CHECK (Amount > 0),
    Status VARCHAR(50) NOT NULL,
    PaymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PaymentMethod VARCHAR(50) NOT NULL,
    PassengerId INT NOT NULL REFERENCES Passenger(PassengerId) ON DELETE CASCADE,
    TicketNumber INT NOT NULL UNIQUE REFERENCES Ticket(TicketNumber) ON DELETE CASCADE
);

-- Create the Passenger_Flight junction table
-- (If you want to record that a passenger has "checked" or inquired about a flight)
CREATE TABLE Passenger_Flight (
    PassengerId INT NOT NULL REFERENCES Passenger(PassengerId) ON DELETE CASCADE,
    FlightId INT NOT NULL REFERENCES Flight(FlightId) ON DELETE CASCADE,
    InquiryDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (PassengerId, FlightId)
);



-- Create the Class table (Each flight can have multiple classes)
-- CREATE TABLE Class (
--     ClassId SERIAL PRIMARY KEY,
--     FlightId INT NOT NULL REFERENCES Flight(FlightId) ON DELETE CASCADE,
--     ClassType VARCHAR(50) NOT NULL
-- );

-- Create the Ticket table (Updated to reference Class instead of storing ClassType as text)
-- CREATE TABLE Ticket (
--     TicketNumber SERIAL PRIMARY KEY,
--     SeatNumber VARCHAR(10) NOT NULL,
--     FlightId INT NOT NULL REFERENCES Flight(FlightId) ON DELETE CASCADE,
--     PassengerId INT NOT NULL REFERENCES Passenger(PassengerId) ON DELETE CASCADE,
--     ClassId INT NOT NULL REFERENCES Class(ClassId),
--     DateTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );