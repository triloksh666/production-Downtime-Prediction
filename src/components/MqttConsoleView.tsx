import React, { useState } from 'react';
import { lineEngine } from '../services/simulationEngine';
import { Radio, Terminal, Copy, Check, Server, Shield, Database, ExternalLink } from 'lucide-react';

export const MqttConsoleView: React.FC = () => {
  const packets = lineEngine.getMqttPackets();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCommand = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const commands = [
    { label: 'Start HiveMQ Community Edition (Docker)', cmd: 'docker compose up -d hivemq' },
    { label: 'Subscribe to Telemetry (mosquitto_sub)', cmd: 'mosquitto_sub -h localhost -p 1883 -t "factory/line1/+/telemetry" -v' },
    { label: 'Subscribe to Real-time Predictions', cmd: 'mosquitto_sub -h localhost -p 1883 -t "factory/line1/predictions/+" -v' },
    { label: 'Subscribe to Active Alerts', cmd: 'mosquitto_sub -h localhost -p 1883 -t "factory/line1/alerts" -v' },
    { label: 'Generate 30 Days Historical Data', cmd: 'python -m src.simulator.cli --mode batch --duration-hours 720' },
    { label: 'Train ML Models (XGBoost + RUL + Anomaly)', cmd: 'python -m src.ml.train --db-path data/factory.db' }
  ];

  return (
    <div className="space-y-4">
      {/* Top Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="tech-box rounded p-3 font-mono">
          <div className="text-[10px] text-slate-500 font-tech uppercase font-semibold">Broker Type</div>
          <div className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-cyan-600" />
            <span>HiveMQ CE (v4.28)</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1">● TCP Port 1883 / WS 8000</div>
        </div>

        <div className="tech-box rounded p-3 font-mono">
          <div className="text-[10px] text-slate-500 font-tech uppercase font-semibold">MQTT Protocol Spec</div>
          <div className="text-lg font-bold text-slate-900 mt-1">MQTT v5.0 (Paho v2)</div>
          <div className="text-[10px] text-slate-600 mt-1">Delivery: Guaranteed QoS 1</div>
        </div>

        <div className="tech-box rounded p-3 font-mono">
          <div className="text-[10px] text-slate-500 font-tech uppercase font-semibold">Last Will &amp; Testament</div>
          <div className="text-lg font-bold text-amber-700 mt-1">Enabled (LWT)</div>
          <div className="text-[10px] text-slate-600 mt-1">factory/line1/gateway/lwt</div>
        </div>

        <div className="tech-box rounded p-3 font-mono">
          <div className="text-[10px] text-slate-500 font-tech uppercase font-semibold">Storage Engine</div>
          <div className="text-lg font-bold text-purple-700 mt-1">SQLite (WAL Mode)</div>
          <div className="text-[10px] text-slate-600 mt-1">factory.db (Zero-lock concurrency)</div>
        </div>
      </div>

      {/* Grid: Live Packet Stream + Terminal Commands */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Live Packet Stream (7 Cols) */}
        <div className="lg:col-span-7 tech-box rounded p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-600 animate-pulse" />
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                Live MQTT Packet Inspector (HiveMQ Virtual Bus)
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 font-bold">● 5.0 MSGS/S</span>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto font-mono text-xs pr-1">
            {packets.length === 0 ? (
              <div className="text-slate-500 py-8 text-center">Awaiting MQTT packets...</div>
            ) : (
              packets.map((pkt, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-50 border border-slate-200 hover:border-cyan-400 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-cyan-800 font-bold truncate max-w-[280px]">
                      {pkt.topic}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-1 py-0.2 bg-slate-200 text-[9px] rounded text-slate-700 font-bold">
                        QoS {pkt.qos}
                      </span>
                      <span className="text-[10px] text-slate-500">{pkt.ts}</span>
                    </div>
                  </div>
                  <pre className="text-[10px] text-slate-800 bg-white p-2 rounded border border-slate-200 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(pkt.payload, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CLI & Terminal Quick Commands (5 Cols) */}
        <div className="lg:col-span-5 tech-box rounded p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-600" />
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                Terminal Commands (Laptop Run)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">BASH / MAKE</span>
          </div>

          <div className="space-y-2.5 my-2">
            {commands.map((c, i) => (
              <div key={i} className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-xs">
                <div className="text-[10px] text-slate-500 font-tech mb-1 font-semibold">{c.label}</div>
                <div className="flex items-center justify-between bg-white p-1.5 rounded border border-slate-200 text-[11px] text-cyan-900 font-bold gap-2">
                  <span className="truncate">{c.cmd}</span>
                  <button
                    onClick={() => copyCommand(c.cmd, i)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded shrink-0 transition-colors"
                    title="Copy command"
                  >
                    {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[10px] font-mono text-amber-900 font-medium">
            HiveMQ Web Control Center runs on port <span className="font-bold">http://localhost:8080</span> to visualize MQTT client sessions and message queues.
          </div>
        </div>
      </div>
    </div>
  );
};
