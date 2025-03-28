// src/FlightSearch.js
import React, { useState } from 'react';

const FlightSearch = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch(
        `/api/flights?origin=${origin}&destination=${destination}&departureDate=${departureDate}`
      );
      if (!response.ok) {
        setError('Error fetching flights');
      } else {
        const data = await response.json();
        setFlights(data);
      }
    } catch (err) {
      setError('Error fetching flights');
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        />
        <br />
        <input
          type="text"
          placeholder="Destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <br />
        <input
          type="date"
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
        />
        <br />
        <button type="submit">Search Flights</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {flights.map((flight) => (
          <li key={flight.FlightId}>
            Flight {flight.FlightNumber}: {flight.Origin} → {flight.Destination} at{' '}
            {new Date(flight.DepartureTime).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FlightSearch;
