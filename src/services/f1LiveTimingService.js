/**
 * @file f1LiveTimingService.js
 * @description Service for connecting to F1 Official Live Timing API via SignalR
 * Official endpoint: https://livetiming.formula1.com/signalr
 */

import * as signalR from "@microsoft/signalr";

const SIGNALR_HUB_URL = "https://livetiming.formula1.com/signalr";
const HUB_NAME = "Streaming";

class F1LiveTimingService {
  constructor() {
    this.connection = null;
    this.isConnected = false;
    this.sessionInfo = null;
    this.timingData = {};
    this.driverList = {};
    this.carData = {};
    this.position = {};
    this.stints = {};
    this.pitData = {};
    this.sessionStatus = null;
    this.trackStatus = null;
    this.lapCount = 0;

    // Callbacks
    this.onSessionInfoUpdate = null;
    this.onTimingDataUpdate = null;
    this.onDriverListUpdate = null;
    this.onPositionUpdate = null;
    this.onCarDataUpdate = null;
    this.onSessionStatusUpdate = null;
    this.onTrackStatusUpdate = null;
    this.onLapCountUpdate = null;
  }

  /**
   * Connect to F1 Live Timing SignalR hub
   */
  async connect() {
    try {
      if (this.isConnected) {
        console.log("Already connected to F1 Live Timing");
        return;
      }

      // Build connection
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(SIGNALR_HUB_URL)
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      // Start connection
      await this.connection.start();
      console.log("✅ Connected to F1 Live Timing");
      this.isConnected = true;

      // Subscribe to hub
      await this.subscribeToHub();
    } catch (error) {
      console.error("❌ Error connecting to F1 Live Timing:", error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Subscribe to the Streaming hub
   */
  async subscribeToHub() {
    try {
      if (!this.connection) return;

      // Subscribe to all available topics
      await this.connection.invoke("Subscribe", [
        "Heartbeat",
        "SessionInfo",
        "SessionData",
        "SessionStatus",
        "DriverList",
        "TimingData",
        "TimingAppData",
        "TimingStats",
        "Position.z",
        "CarData.z",
        "WeatherData",
        "TrackStatus",
        "TeamRadio",
        "RaceControlMessages",
        "LapCount",
        "TopThree",
      ]);

      console.log("✅ Subscribed to F1 Live Timing topics");
    } catch (error) {
      console.error("❌ Error subscribing to hub:", error);
    }
  }

  /**
   * Set up SignalR event handlers
   */
  setupEventHandlers() {
    if (!this.connection) return;

    // Feed update handler - main data stream
    this.connection.on("feed", (topic, data, timestamp) => {
      this.handleFeedUpdate(topic, data, timestamp);
    });

    // Connection events
    this.connection.onreconnecting((error) => {
      console.warn("⚠️ Reconnecting to F1 Live Timing...", error);
      this.isConnected = false;
    });

    this.connection.onreconnected((connectionId) => {
      console.log("✅ Reconnected to F1 Live Timing", connectionId);
      this.isConnected = true;
      this.subscribeToHub();
    });

    this.connection.onclose((error) => {
      console.log("❌ Disconnected from F1 Live Timing", error);
      this.isConnected = false;
    });
  }

  /**
   * Handle feed updates from SignalR
   */
  handleFeedUpdate(topic, data, timestamp) {
    try {
      // Parse data if it's a string
      const parsedData = typeof data === "string" ? JSON.parse(data) : data;

      switch (topic) {
        case "SessionInfo":
          this.sessionInfo = parsedData;
          if (this.onSessionInfoUpdate) this.onSessionInfoUpdate(parsedData);
          break;

        case "SessionStatus":
          this.sessionStatus = parsedData.Status;
          if (this.onSessionStatusUpdate) this.onSessionStatusUpdate(parsedData);
          break;

        case "DriverList":
          Object.assign(this.driverList, parsedData);
          if (this.onDriverListUpdate) this.onDriverListUpdate(this.driverList);
          break;

        case "TimingData":
        case "TimingAppData":
          // Merge timing data
          if (parsedData.Lines) {
            Object.entries(parsedData.Lines).forEach(([driverNum, driverData]) => {
              if (!this.timingData[driverNum]) {
                this.timingData[driverNum] = {};
              }
              Object.assign(this.timingData[driverNum], driverData);
            });
          }
          if (this.onTimingDataUpdate) this.onTimingDataUpdate(this.timingData);
          break;

        case "Position.z":
          // Decompress and handle position data
          const positionData = this.decompressData(parsedData);
          if (positionData && positionData.Position) {
            Object.entries(positionData.Position).forEach(([driverNum, pos]) => {
              this.position[driverNum] = pos;
            });
          }
          if (this.onPositionUpdate) this.onPositionUpdate(this.position);
          break;

        case "CarData.z":
          // Decompress and handle car data
          const carData = this.decompressData(parsedData);
          if (carData && carData.Entries) {
            Object.entries(carData.Entries).forEach(([driverNum, data]) => {
              this.carData[driverNum] = data;
            });
          }
          if (this.onCarDataUpdate) this.onCarDataUpdate(this.carData);
          break;

        case "TrackStatus":
          this.trackStatus = parsedData.Status;
          if (this.onTrackStatusUpdate) this.onTrackStatusUpdate(parsedData);
          break;

        case "LapCount":
          this.lapCount = parsedData.CurrentLap || 0;
          if (this.onLapCountUpdate) this.onLapCountUpdate(parsedData);
          break;

        default:
          // Store other data types
          break;
      }
    } catch (error) {
      console.error(`Error handling ${topic}:`, error);
    }
  }

  /**
   * Decompress zlib compressed data (for Position.z and CarData.z)
   */
  decompressData(compressedData) {
    try {
      // F1 sends compressed data as base64, we need to decompress it
      // For now, return as-is - decompression requires pako library
      // TODO: Add pako for proper decompression
      return compressedData;
    } catch (error) {
      console.error("Error decompressing data:", error);
      return null;
    }
  }

  /**
   * Get current timing data formatted for display
   */
  getFormattedTimingData() {
    const formatted = [];

    Object.entries(this.timingData).forEach(([driverNum, data]) => {
      const driver = this.driverList[driverNum];
      if (!driver) return;

      formatted.push({
        number: driverNum,
        position: data.Line || data.Position || "—",
        name: driver.Tla || driver.RacingNumber,
        fullName: `${driver.FirstName} ${driver.LastName}`,
        team: driver.TeamName,
        teamColor: driver.TeamColour,
        gap: data.IntervalToPositionAhead?.Value || data.GapToLeader || "—",
        lastLap: data.LastLapTime?.Value || "—",
        bestLap: data.BestLapTime?.Value || "—",
        sector1: data.Sectors?.[0]?.Value || "—",
        sector2: data.Sectors?.[1]?.Value || "—",
        sector3: data.Sectors?.[2]?.Value || "—",
        q1: data.Stats?.Q1 || data.BestTimes?.Q1 || "—",
        q2: data.Stats?.Q2 || data.BestTimes?.Q2 || "—",
        q3: data.Stats?.Q3 || data.BestTimes?.Q3 || "—",
        speed: data.Speeds?.ST?.Value || "—",
        compound: data.Tyre || "UNKNOWN",
        inPit: data.InPit || false,
        pitStops: data.NumberOfPitStops || 0,
        retired: data.Retired || false,
        stopped: data.Stopped || false,
      });
    });

    // Sort by position
    return formatted.sort((a, b) => {
      const posA = typeof a.position === "number" ? a.position : parseInt(a.position) || 999;
      const posB = typeof b.position === "number" ? b.position : parseInt(b.position) || 999;
      return posA - posB;
    });
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession() {
    return this.sessionInfo !== null && this.sessionStatus !== "Inactive";
  }

  /**
   * Get session information
   */
  getSessionInfo() {
    return this.sessionInfo;
  }

  /**
   * Get session status
   */
  getSessionStatus() {
    return this.sessionStatus;
  }

  /**
   * Get track status
   */
  getTrackStatus() {
    return this.trackStatus;
  }

  /**
   * Get current lap count
   */
  getLapCount() {
    return this.lapCount;
  }

  /**
   * Disconnect from SignalR hub
   */
  async disconnect() {
    try {
      if (this.connection) {
        await this.connection.stop();
        console.log("Disconnected from F1 Live Timing");
      }
      this.isConnected = false;
      this.resetData();
    } catch (error) {
      console.error("Error disconnecting:", error);
    }
  }

  /**
   * Reset all data
   */
  resetData() {
    this.sessionInfo = null;
    this.timingData = {};
    this.driverList = {};
    this.carData = {};
    this.position = {};
    this.stints = {};
    this.pitData = {};
    this.sessionStatus = null;
    this.trackStatus = null;
    this.lapCount = 0;
  }
}

// Export singleton instance
export default new F1LiveTimingService();
