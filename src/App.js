// src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Register from './Register';
import './App.css';

function App() {
  const [view, setView] = useState('login'); // "login", "register", or "dashboard"
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [user, setUser] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [ticketToCancel, setTicketToCancel] = useState(null);

  // States for flight search
  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDestination, setSearchDestination] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Selected flight and class
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [flightClasses, setFlightClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [availableSeats, setAvailableSeats] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState('');

  // Booking payment details (now only payment method is set)
  const [bookingPaymentData, setBookingPaymentData] = useState({
    paymentMethod: ''
  });

  // Tickets for the logged-in passenger
  const [tickets, setTickets] = useState([]);

  // Pricing mapping for different classes
  const priceMapping = {
    'Economy': 350,
    'Business': 1600,
    'First': 2500,
  };

  // Add new state for taken seats
  const [takenSeats, setTakenSeats] = useState([]);

  // Add new state for passenger view
  const [passengerView, setPassengerView] = useState('search'); // 'search' or 'tickets'

  // Helper function to format date strings (converts "YYYY-MM-DD HH:MM:SS" to ISO format)
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Invalid Date';
    return new Date(dateStr.replace(' ', 'T')).toLocaleString();
  };

  // Helper function to ensure class type matches database
  const getClassType = (classType) => {
    // The database uses exactly: 'Economy', 'Business', 'First'
    if (!classType) return 'Economy';
    
    // Convert to proper case
    const normalized = classType.charAt(0).toUpperCase() + classType.slice(1).toLowerCase();
    
    // Only return valid class types
    if (['Economy', 'Business', 'First'].includes(normalized)) {
      return normalized;
    }
    
    // Default to Economy if invalid
    return 'Economy';
  };

  // -------------------------
  // Authentication Functions
  // -------------------------
  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/login', loginData);
      console.log('Login response:', res.data);
      setUser(res.data);
      setView('dashboard');
      if (res.data.adminid) {
        console.log('Admin logged in, setting admin view...');
        setAdminView('flights');
        fetchAllFlights();
      } else {
        fetchTickets(res.data.passengerid);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
  };

  // -------------------------
  // Flight Search Functions
  // -------------------------
  const searchFlights = async () => {
    try {
      // Assumes a backend endpoint /api/search-flights that accepts origin, destination, and date.
      const res = await axios.get('http://localhost:5000/api/search-flights', {
        params: {
          origin: searchOrigin,
          destination: searchDestination,
          date: searchDate,
        }
      });
      setSearchResults(res.data);
      // Reset selected flight and class info
      setSelectedFlight(null);
      setFlightClasses([]);
      setSelectedClass(null);
      setSelectedSeat('');
    } catch (error) {
      console.error('Error searching flights:', error);
      alert('Error searching flights');
    }
  };

  // When a flight is selected, fetch its available classes.
  const handleFlightSelect = (flight) => {
    setSelectedFlight(flight);
    fetchFlightClasses(flight.flightid);
    setSelectedClass(null);
    setSelectedSeat('');
  };

  // Fetch flight classes for the selected flight (assumes endpoint /api/flight-classes/:flightId)
  const fetchFlightClasses = async (flightId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/flight-classes/${flightId}`);
      setFlightClasses(res.data);
    } catch (error) {
      console.error('Error fetching flight classes:', error);
      alert('Error fetching flight classes');
    }
  };

  // When a class is selected, record it and its available seat count.
  const handleClassSelect = async (cls) => {
    setSelectedClass(cls);
    setAvailableSeats(cls.seatsavailable);
    setSelectedSeat('');
    
    try {
      // Get the correct class type
      const correctClassType = getClassType(cls.classtype);
      const res = await axios.get(`http://localhost:5000/api/taken-seats/${selectedFlight.flightid}/${correctClassType}`);
      setTakenSeats(res.data);
    } catch (error) {
      console.error('Error fetching taken seats:', error);
    }
  };

  // -------------------------
  // Seat Selection
  // -------------------------
  // Generate seat options with proper airplane layout
  const renderSeatOptions = () => {
    const rows = Math.ceil(availableSeats / 6); // 6 seats per row (3 on each side)
    const seats = [];
    
    for (let row = 1; row <= rows; row++) {
      // Left side seats (A, B, C)
      seats.push(`A${row}`);
      seats.push(`B${row}`);
      seats.push(`C${row}`);
      // Right side seats (D, E, F)
      seats.push(`D${row}`);
      seats.push(`E${row}`);
      seats.push(`F${row}`);
    }
    
    return seats;
  };

  // -------------------------
  // Booking and Tickets Functions
  // -------------------------
  const bookFlight = async () => {
    if (!selectedFlight || !selectedClass || !selectedSeat || !bookingPaymentData.paymentMethod) {
      alert('Please select a flight, class, seat, and payment method.');
      return;
    }
    try {
      // Get the correct class type
      const correctClassType = getClassType(selectedClass.classtype);
      
      // Automatically determine cost from the selected class.
      const cost = priceMapping[correctClassType] || 0;
      
      // Ensure we're using the correct class type from the database
      const payload = {
        seatNumber: selectedSeat,
        flightId: parseInt(selectedFlight.flightid),
        passengerId: parseInt(user.passengerid),
        classType: correctClassType,
        amount: parseFloat(cost),
        status: 'Completed',
        paymentMethod: bookingPaymentData.paymentMethod,
      };
      
      // Log the payload for debugging
      console.log('Booking payload:', payload);
      console.log('Original class type:', selectedClass.classtype);
      console.log('Corrected class type:', correctClassType);
      
      const res = await axios.post('http://localhost:5000/api/book', payload);
      
      console.log('Booking response:', res.data);
      alert(`Flight booked! Ticket Number: ${res.data.ticketnumber}`);
      
      // Reset the form
      setSelectedFlight(null);
      setSelectedClass(null);
      setSelectedSeat('');
      setBookingPaymentData({ paymentMethod: '' });
      
      // Refresh tickets
      fetchTickets(user.passengerid);
    } catch (error) {
      // Log detailed error information
      console.error('Booking error:', error.response ? error.response.data : error.message);
      alert('Error booking flight: ' + (error.response ? error.response.data.error : error.message));
    }
  };
  

  // Fetch tickets for the logged-in passenger.
  const fetchTickets = async (passengerId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/my-tickets/${passengerId}`);
      setTickets(res.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  // Update cancel ticket function
  const handleCancelClick = (ticketNumber) => {
    setTicketToCancel(ticketNumber);
    setShowConfirmDialog(true);
  };

  const cancelTicket = async () => {
    try {
      await axios.post('http://localhost:5000/api/cancel', {
        ticketNumber: parseInt(ticketToCancel),
        refundAmount: tickets.find(t => t.ticketnumber === ticketToCancel).amount,
        changedBy: user.fullname
      });
      
      alert('Ticket cancelled successfully!');
      // Refresh the tickets list
      fetchTickets(user.passengerid);
      // Close the dialog
      setShowConfirmDialog(false);
      setTicketToCancel(null);
    } catch (error) {
      console.error('Error cancelling ticket:', error);
      alert('Error cancelling ticket: ' + (error.response ? error.response.data.error : error.message));
    }
  };

  // Add admin-specific functions
  const fetchAllFlights = async () => {
    try {
      console.log('Fetching all flights...');
      const res = await axios.get('http://localhost:5000/api/flights');
      console.log('Flights response:', res.data);
      setAllFlights(res.data);
    } catch (error) {
      console.error('Error fetching flights:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const fetchFlightPassengers = async (flightId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/flight-passengers/${flightId}`);
      setFlightPassengers(res.data);
      setSelectedFlightForAdmin(flightId);
    } catch (error) {
      console.error('Error fetching flight passengers:', error);
    }
  };

  const [adminView, setAdminView] = useState('flights'); // 'flights', 'passengers', 'tickets'
  const [selectedFlightForAdmin, setSelectedFlightForAdmin] = useState(null);
  const [flightPassengers, setFlightPassengers] = useState([]);
  const [allFlights, setAllFlights] = useState([]);
  const [showDeleteFlightDialog, setShowDeleteFlightDialog] = useState(false);
  const [showCancelPassengerDialog, setShowCancelPassengerDialog] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState(null);

  const handleDeleteFlightClick = (flightId) => {
    setFlightToDelete(flightId);
    setShowDeleteFlightDialog(true);
  };

  const handleCancelPassengerClick = (ticketNumber) => {
    setTicketToCancel(ticketNumber);
    setShowCancelPassengerDialog(true);
  };

  const removeFlight = async () => {
    try {
      await axios.delete(`http://localhost:5000/api/flights/${flightToDelete}`);
      alert('Flight removed successfully');
      fetchAllFlights();
      setShowDeleteFlightDialog(false);
      setFlightToDelete(null);
    } catch (error) {
      console.error('Error removing flight:', error);
      alert('Error removing flight: ' + (error.response ? error.response.data.error : error.message));
    }
  };

  const cancelPassengerTicket = async () => {
    try {
      // Find the passenger in flightPassengers to get the amount
      const passenger = flightPassengers.find(p => p.ticketnumber === ticketToCancel);
      if (!passenger) {
        throw new Error('Passenger not found');
      }

      console.log('Attempting to cancel ticket:', {
        ticketNumber: ticketToCancel,
        refundAmount: passenger.amount,
        adminName: user.fullname
      });

      await axios.post('http://localhost:5000/api/cancel', {
        ticketNumber: parseInt(ticketToCancel),
        refundAmount: passenger.amount,
        changedBy: user.fullname
      });
      
      alert('Ticket cancelled successfully');
      if (selectedFlightForAdmin) {
        fetchFlightPassengers(selectedFlightForAdmin);
      }
      setShowCancelPassengerDialog(false);
      setTicketToCancel(null);
    } catch (error) {
      console.error('Error cancelling ticket:', error);
      alert('Error cancelling ticket: ' + (error.response ? error.response.data.error : error.message));
    }
  };

  // Update useEffect to fetch data when admin views change
  useEffect(() => {
    console.log('useEffect triggered:', { user, adminView, selectedFlightForAdmin });
    if (user?.adminid) {
      console.log('Admin logged in, fetching data...');
      if (adminView === 'flights') {
        fetchAllFlights();
      } else if (adminView === 'passengers' && selectedFlightForAdmin) {
        fetchFlightPassengers(selectedFlightForAdmin);
      }
    }
  }, [user, adminView, selectedFlightForAdmin]);

  // Add new state for editing flight times
  const [editingFlight, setEditingFlight] = useState(null);
  const [newDepartureTime, setNewDepartureTime] = useState('');
  const [newArrivalTime, setNewArrivalTime] = useState('');

  // Update flight times function
  const updateFlightTimes = async () => {
    try {
      await axios.put(`http://localhost:5000/api/flights/${editingFlight.flightid}`, {
        departureTime: newDepartureTime,
        arrivalTime: newArrivalTime
      });
      alert('Flight times updated successfully');
      setEditingFlight(null);
      setNewDepartureTime('');
      setNewArrivalTime('');
      fetchAllFlights(); // Refresh the flights list
    } catch (error) {
      console.error('Error updating flight times:', error);
      alert('Error updating flight times: ' + (error.response ? error.response.data.error : error.message));
    }
  };

  // -------------------------
  // Render UI
  // -------------------------
  return (
    <div className="App">
      <h1>✈️ Airline Booking System</h1>

      {view === 'login' && (
        <div className="login-container">
          <h2>Welcome Back</h2>
          <input
            type="text"
            placeholder="Username"
            value={loginData.username}
            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
          />
          <button onClick={handleLogin}>Login</button>
          <p>
            Don't have an account?{' '}
            <button onClick={() => setView('register')}>Register Now</button>
          </p>
        </div>
      )}

      {view === 'register' && (
        <div className="register-container">
          <Register onRegisterSuccess={() => setView('login')} />
          <p>
            Already have an account?{' '}
            <button onClick={() => setView('login')}>Back to Login</button>
          </p>
        </div>
      )}

      {view === 'dashboard' && user && (
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h2>Welcome, {user.passengername || user.adminname}</h2>
            <div className="header-controls">
              {user.adminid && (
                <div className="admin-controls">
                  <button 
                    className={adminView === 'flights' ? 'active' : ''} 
                    onClick={() => setAdminView('flights')}
                  >
                    Manage Flights
                  </button>
                  <button 
                    className={adminView === 'passengers' ? 'active' : ''} 
                    onClick={() => setAdminView('passengers')}
                  >
                    View Passengers
                  </button>
                </div>
              )}
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>

          {/* Admin Views */}
          {user.adminid && (
            <>
              {adminView === 'flights' && (
                <div className="admin-flights-section">
                  <h3>Manage Flights</h3>
                  {allFlights.length === 0 ? (
                    <p>No flights available.</p>
                  ) : (
                    <div className="flights-grid">
                      {allFlights.map((flight) => (
                        <div key={flight.flightid} className="flight-card">
                          <div className="flight-info">
                            <div><strong>Flight:</strong> {flight.flightnumber}</div>
                            <div><strong>From:</strong> {flight.origin}</div>
                            <div><strong>To:</strong> {flight.destination}</div>
                            <div><strong>Departure:</strong> {formatDate(flight.departuretime)}</div>
                            <div><strong>Arrival:</strong> {formatDate(flight.arrivaltime)}</div>
                          </div>
                          <div className="admin-flight-controls">
                            <button onClick={() => {
                              setSelectedFlightForAdmin(flight.flightid);
                              setAdminView('passengers');
                            }}>
                              View Passengers
                            </button>
                            <button 
                              className="edit-button"
                              onClick={() => {
                                setEditingFlight(flight);
                                setNewDepartureTime(flight.departuretime);
                                setNewArrivalTime(flight.arrivaltime);
                              }}
                            >
                              Edit Times
                            </button>
                            <button 
                              className="delete-button"
                              onClick={() => handleDeleteFlightClick(flight.flightid)}
                            >
                              Delete Flight
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {adminView === 'passengers' && (
                <div className="admin-passengers-section">
                  <div className="section-header">
                    <h3>Passengers</h3>
                    <button 
                      className="back-button"
                      onClick={() => {
                        setSelectedFlightForAdmin(null);
                        setAdminView('flights');
                      }}
                    >
                      Back to Flights
                    </button>
                  </div>
                  {selectedFlightForAdmin ? (
                    <>
                      <h4>Flight {selectedFlightForAdmin}</h4>
                      {flightPassengers.length === 0 ? (
                        <p>No passengers on this flight.</p>
                      ) : (
                        <div className="passengers-grid">
                          {flightPassengers.map((passenger) => (
                            <div key={passenger.ticketnumber} className="passenger-card">
                              <div className="passenger-info">
                                <div><strong>Name:</strong> {passenger.passengername}</div>
                                <div><strong>Ticket:</strong> #{passenger.ticketnumber}</div>
                                <div><strong>Seat:</strong> {passenger.seatnumber}</div>
                                <div><strong>Class:</strong> {passenger.classtype}</div>
                                <div><strong>Status:</strong> {passenger.paymentstatus}</div>
                              </div>
                              {passenger.paymentstatus === 'Completed' && (
                                <button 
                                  className="cancel-button"
                                  onClick={() => handleCancelPassengerClick(passenger.ticketnumber)}
                                >
                                  Cancel Ticket
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p>Please select a flight to view passengers.</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Regular passenger views */}
          {!user.adminid && (
            <>
              {/* Passenger View Tabs */}
              <div className="passenger-tabs">
                <button 
                  className={passengerView === 'search' ? 'active' : ''} 
                  onClick={() => setPassengerView('search')}
                >
                  Search Flights
                </button>
                <button 
                  className={passengerView === 'tickets' ? 'active' : ''} 
                  onClick={() => setPassengerView('tickets')}
                >
                  My Tickets
                </button>
              </div>

              {/* Flight Search Section */}
              {passengerView === 'search' && (
                <>
                  <div className="search-section">
                    <h3>Search Flights</h3>
                    <div className="search-inputs">
                      <input
                        type="text"
                        placeholder="From (e.g., JFK)"
                        value={searchOrigin}
                        onChange={(e) => setSearchOrigin(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="To (e.g., LAX)"
                        value={searchDestination}
                        onChange={(e) => setSearchDestination(e.target.value)}
                      />
                      <input
                        type="date"
                        value={searchDate}
                        onChange={(e) => setSearchDate(e.target.value)}
                      />
                      <button onClick={searchFlights}>Search Flights</button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      <h3>Available Flights</h3>
                      {searchResults.map((flight) => (
                        <div key={flight.flightid} className="flight-card">
                          <div className="flight-info">
                            <div>
                              <strong>Flight:</strong> {flight.flightnumber}
                            </div>
                            <div>
                              <strong>From:</strong> {flight.origin}
                            </div>
                            <div>
                              <strong>To:</strong> {flight.destination}
                            </div>
                            <div>
                              <strong>Departure:</strong> {formatDate(flight.departuretime)}
                            </div>
                            <div>
                              <strong>Arrival:</strong> {formatDate(flight.arrivaltime)}
                            </div>
                          </div>
                          <button onClick={() => handleFlightSelect(flight)}>
                            Select Flight
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Flight Selection and Booking */}
                  {selectedFlight && (
                    <div className="booking-section">
                      <h3>Complete Your Booking</h3>
                      <div className="flight-info">
                        <div>
                          <strong>Selected Flight:</strong> {selectedFlight.flightnumber}
                        </div>
                        <div>
                          <strong>From:</strong> {selectedFlight.origin}
                        </div>
                        <div>
                          <strong>To:</strong> {selectedFlight.destination}
                        </div>
                      </div>

                      {/* Class Selection */}
                      <div className="class-selection">
                        <h4>Select Class</h4>
                        {flightClasses.map((cls) => (
                          <button
                            key={cls.classtype}
                            className={selectedClass?.classtype === cls.classtype ? 'selected' : ''}
                            onClick={() => handleClassSelect(cls)}
                          >
                            {cls.classtype} - ${priceMapping[cls.classtype]}
                          </button>
                        ))}
                      </div>

                      {/* Seat Selection */}
                      {selectedClass && (
                        <div className="seat-selection">
                          <h4>Select Seat</h4>
                          <div className="airplane-layout">
                            <div className="airplane-front">
                              <span>Front</span>
                            </div>
                            <div className="seat-grid">
                              {renderSeatOptions().map((seat) => {
                                const isTaken = takenSeats.includes(seat);
                                return (
                                  <div
                                    key={seat}
                                    className={`seat-option ${selectedSeat === seat ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
                                    onClick={() => !isTaken && setSelectedSeat(seat)}
                                    title={isTaken ? 'Seat taken' : 'Available seat'}
                                  >
                                    {seat}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="airplane-back">
                              <span>Back</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment Method */}
                      <div className="payment-section">
                        <h4>Payment Method</h4>
                        <select
                          value={bookingPaymentData.paymentMethod}
                          onChange={(e) => setBookingPaymentData({ ...bookingPaymentData, paymentMethod: e.target.value })}
                        >
                          <option value="">Select Payment Method</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Debit Card">Debit Card</option>
                          <option value="PayPal">PayPal</option>
                        </select>
                      </div>

                      {/* Book Button */}
                      <button onClick={bookFlight} className="book-button">
                        Book Flight
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Tickets Section */}
              {passengerView === 'tickets' && (
                <div className="tickets-section">
                  <h2>My Tickets</h2>
                  <div className="tickets-grid">
                    {tickets.map((ticket) => (
                      <div key={ticket.ticketnumber} className="ticket-card">
                        <div className="ticket-header">
                          <h3>Ticket #{ticket.ticketnumber}</h3>
                          <span className={`status-badge ${ticket.paymentstatus.toLowerCase()}`}>
                            {ticket.paymentstatus}
                          </span>
                        </div>
                        <div className="ticket-details">
                          <p><strong>Flight:</strong> {ticket.flightnumber}</p>
                          <p><strong>From:</strong> {ticket.origin}</p>
                          <p><strong>To:</strong> {ticket.destination}</p>
                          <p><strong>Seat:</strong> {ticket.seatnumber}</p>
                          <p><strong>Class:</strong> {ticket.classtype}</p>
                          <p><strong>Date:</strong> {formatDate(ticket.datetime)}</p>
                          <p><strong>Amount:</strong> ${ticket.amount}</p>
                        </div>
                        {ticket.paymentstatus === 'Completed' && (
                          <button 
                            className="cancel-button"
                            onClick={() => handleCancelClick(ticket.ticketnumber)}
                          >
                            Cancel Ticket
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add confirmation dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Cancel Ticket</h3>
            <p>Are you sure you want to cancel this ticket?</p>
            <div className="modal-buttons">
              <button onClick={() => setShowConfirmDialog(false)} className="cancel-button">
                No, Keep Ticket
              </button>
              <button onClick={cancelTicket} className="confirm-button">
                Yes, Cancel Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add cancel passenger dialog */}
      {showCancelPassengerDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Cancel Passenger Ticket</h3>
            <p>Are you sure you want to cancel this passenger's ticket?</p>
            <div className="modal-buttons">
              <button onClick={() => setShowCancelPassengerDialog(false)} className="cancel-button">
                No, Keep Ticket
              </button>
              <button onClick={cancelPassengerTicket} className="confirm-button">
                Yes, Cancel Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add delete flight dialog */}
      {showDeleteFlightDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Delete Flight</h3>
            <p>Are you sure you want to delete this flight?</p>
            <div className="modal-buttons">
              <button onClick={() => setShowDeleteFlightDialog(false)} className="cancel-button">
                No, Keep Flight
              </button>
              <button onClick={removeFlight} className="confirm-button">
                Yes, Delete Flight
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add edit flight times modal */}
      {editingFlight && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Flight Times</h3>
            <div className="edit-form">
              <div className="form-group">
                <label>Flight: {editingFlight.flightnumber}</label>
              </div>
              <div className="form-group">
                <label>From: {editingFlight.origin}</label>
              </div>
              <div className="form-group">
                <label>To: {editingFlight.destination}</label>
              </div>
              <div className="form-group">
                <label>New Departure Time:</label>
                <input
                  type="datetime-local"
                  value={newDepartureTime}
                  onChange={(e) => setNewDepartureTime(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>New Arrival Time:</label>
                <input
                  type="datetime-local"
                  value={newArrivalTime}
                  onChange={(e) => setNewArrivalTime(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setEditingFlight(null)} className="cancel-button">
                Cancel
              </button>
              <button onClick={updateFlightTimes} className="confirm-button">
                Update Times
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
