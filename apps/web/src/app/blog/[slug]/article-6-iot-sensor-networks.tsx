"use client";

import Link from "next/link";
import { AnimatedSection } from "@/components/shared/AnimatedSection";

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
      <div className="text-2xl font-bold text-cyan-400 mb-1">{value}</div>
      <div className="text-xs text-white/50 font-body">{label}</div>
    </div>
  );
}

function TableOfContents() {
  return (
    <nav className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-10" aria-label="Table of contents">
      <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">Contents</h2>
      <ul className="space-y-2 text-sm font-body">
        <li><a href="#physical-layer" className="text-emerald-400 hover:text-emerald-300 transition-colors">The Physical Layer of Verification</a></li>
        <li><a href="#sensor-types" className="text-emerald-400 hover:text-emerald-300 transition-colors">Sensor Types and Specifications</a></li>
        <li><a href="#data-pipeline" className="text-emerald-400 hover:text-emerald-300 transition-colors">Data Pipeline Architecture</a></li>
        <li><a href="#edge-computing" className="text-emerald-400 hover:text-emerald-300 transition-colors">Edge Computing and Pre-Processing</a></li>
        <li><a href="#calibration" className="text-emerald-400 hover:text-emerald-300 transition-colors">Calibration and Drift Management</a></li>
        <li><a href="#tamper-resistance" className="text-emerald-400 hover:text-emerald-300 transition-colors">Tamper Resistance and Security</a></li>
        <li><a href="#redundancy" className="text-emerald-400 hover:text-emerald-300 transition-colors">Redundancy and Fault Tolerance</a></li>
        <li><a href="#deployment" className="text-emerald-400 hover:text-emerald-300 transition-colors">Deployment Considerations</a></li>
        <li><a href="#conclusion" className="text-emerald-400 hover:text-emerald-300 transition-colors">Conclusion</a></li>
      </ul>
    </nav>
  );
}

export function Article6Content() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="article-heading">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <AnimatedSection>
            <div className="mb-6 flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                Research
              </span>
              <span className="text-sm text-white/40 font-body">13 min read</span>
              <span className="text-sm text-white/40 font-body">February 9, 2026</span>
            </div>
            <h1 id="article-heading" className="text-display-lg lg:text-display-xl text-white mb-6 leading-tight">
              IoT Sensor Networks for Carbon Capture Monitoring: A Technical Deep Dive
            </h1>
            <p className="text-lg text-white/70 font-body leading-relaxed mb-8">
              From CO2 flow meters to tamper-resistant edge nodes, the physical layer of Proof-of-Physics determines the
              integrity of every carbon credit. A comprehensive look at our sensor infrastructure.
            </p>
            <div className="flex items-center gap-3 pb-8 border-b border-white/[0.06]">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-sm font-bold">TR</span>
              </div>
              <div>
                <div className="text-sm text-white font-medium">TerraQura Research</div>
                <div className="text-xs text-white/40 font-body">Carbon Verification &amp; Blockchain Infrastructure</div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Content */}
      <section className="relative pb-16 sm:pb-20 lg:pb-24">
        <div className="container mx-auto px-6 sm:px-8 lg:px-10 max-w-4xl">
          <TableOfContents />

          <div className="prose-custom">
            <h2 id="physical-layer" className="text-2xl font-bold text-white mt-12 mb-4">
              The Physical Layer of Verification
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Proof-of-Physics verification is only as reliable as the physical measurements it relies on. While the
              mathematical validation framework and blockchain settlement layer receive significant attention, the sensor
              infrastructure is arguably the most critical component of the entire system. If the sensors produce inaccurate
              data, no amount of sophisticated computation or cryptographic proof can produce a trustworthy carbon credit.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              TerraQura&apos;s sensor network is designed around three principles: measurement accuracy (sensors must produce
              data within known and quantified uncertainty bounds), tamper resistance (the data pipeline must be resistant
              to deliberate manipulation at every point from sensor to blockchain), and operational resilience (the system
              must continue producing valid data through individual sensor failures, network interruptions, and environmental
              extremes).
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              This article provides a detailed examination of the sensor types, data pipeline architecture, calibration
              protocols, and security measures that constitute the physical layer of Proof-of-Physics.
            </p>

            <h2 id="sensor-types" className="text-2xl font-bold text-white mt-12 mb-4">
              Sensor Types and Specifications
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              A typical DAC facility instrumentation package includes five primary sensor categories, each measuring different
              physical parameters relevant to carbon capture verification. The selection of specific sensor models is driven
              by accuracy requirements, environmental suitability, and long-term reliability in industrial settings.
            </p>

            {/* Sensor specs table */}
            <div className="my-8 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/[0.1]">
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Sensor Type</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Measurement</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Range</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Accuracy</th>
                    <th className="text-left py-3 px-4 text-white/80 font-bold">Sample Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["CO2 Flow Meter", "Mass flow of CO2 stream", "0-500 kg/min", "plus or minus 0.5%", "1 Hz"],
                    ["NDIR CO2 Analyzer", "CO2 concentration (ppm)", "0-100% CO2", "plus or minus 1%", "2 Hz"],
                    ["RTD Temperature", "Process temperature", "-40 to 500 C", "plus or minus 0.1 C", "1 Hz"],
                    ["Pressure Transducer", "Process pressure", "0-100 bar", "plus or minus 0.25%", "1 Hz"],
                    ["Humidity Sensor", "Ambient relative humidity", "0-100% RH", "plus or minus 2% RH", "0.5 Hz"],
                    ["Energy Meter", "Electrical consumption", "0-10 MW", "plus or minus 0.5%", "1 Hz"],
                    ["Thermal Energy Meter", "Heat input/output", "0-50 MW thermal", "plus or minus 1%", "1 Hz"],
                  ].map(([type, meas, range, acc, rate], i) => (
                    <tr key={type} className={`border-b border-white/[0.06] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 px-4 text-white/80 font-medium">{type}</td>
                      <td className="py-3 px-4 text-white/50">{meas}</td>
                      <td className="py-3 px-4 text-white/50">{range}</td>
                      <td className="py-3 px-4 text-white/50">{acc}</td>
                      <td className="py-3 px-4 text-white/50">{rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-white/70 font-body leading-relaxed mb-4">
              The CO2 flow meter is the most critical sensor in the array. It directly measures the mass flow rate of CO2
              leaving the capture system, providing the primary input for tonnage calculation. TerraQura specifies Coriolis
              mass flow meters for this measurement because they provide direct mass measurement (not volumetric flow that
              requires density correction), have no moving parts (improving reliability), and maintain accuracy across a
              wide range of flow rates and conditions.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The NDIR (Non-Dispersive Infrared) CO2 analyzer provides a complementary measurement by determining the
              concentration of CO2 in the output stream. Multiplying the flow rate by the concentration gives a cross-check
              on the total CO2 mass. This redundancy is a key element of the multi-sensor validation approach.
            </p>

            <h2 id="data-pipeline" className="text-2xl font-bold text-white mt-12 mb-4">
              Data Pipeline Architecture
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Sensor data flows through a multi-stage pipeline from physical measurement to on-chain attestation. The pipeline
              is designed for both reliability and verifiability, with cryptographic signatures applied at each stage to create
              an unbroken chain of custody.
            </p>

            {/* Data flow diagram */}
            <div className="my-8 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-sm font-bold text-white/80 mb-4 uppercase tracking-wider">Sensor Data Flow</div>
              <div className="space-y-2">
                {[
                  { step: "1. Sensor", desc: "Physical measurement at 1-2 Hz sample rate", detail: "Cryptographic signing at sensor firmware level" },
                  { step: "2. Edge Node", desc: "Local aggregation and initial validation", detail: "30-second aggregation windows, anomaly filtering" },
                  { step: "3. Secure Transport", desc: "TLS 1.3 encrypted transmission to cloud", detail: "Certificate-pinned connections, redundant paths" },
                  { step: "4. Ingestion Gateway", desc: "Cloud-side data validation and normalization", detail: "Schema validation, timestamp reconciliation" },
                  { step: "5. Verification Engine", desc: "Thermodynamic model validation", detail: "Cross-sensor consistency, energy balance checks" },
                  { step: "6. Blockchain", desc: "On-chain attestation and credit minting", detail: "Proof generation, IPFS metadata anchoring" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4 p-3 rounded-lg bg-white/[0.01]">
                    <div className="flex-shrink-0 w-24">
                      <span className="text-emerald-400 font-mono text-sm font-bold">{item.step}</span>
                    </div>
                    <div>
                      <div className="text-white/80 text-sm font-medium">{item.desc}</div>
                      <div className="text-white/40 text-xs font-body">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <h2 id="edge-computing" className="text-2xl font-bold text-white mt-12 mb-4">
              Edge Computing and Pre-Processing
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Each instrumented facility is equipped with ruggedized edge computing nodes that serve as the first aggregation
              and validation point for sensor data. These nodes are based on industrial-grade ARM processors with hardware
              security modules (HSMs) for cryptographic key storage. They run a custom real-time operating system optimized
              for deterministic data processing.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Edge nodes perform several critical functions. Data aggregation compresses the raw 1-2 Hz sensor streams into
              30-second aggregated readings (mean, min, max, standard deviation) to reduce bandwidth requirements without
              losing statistical significance. Anomaly detection identifies sensor readings that fall outside physically
              plausible ranges and flags them before transmission. Time synchronization maintains GPS-disciplined timestamps
              accurate to within 1 millisecond, ensuring all sensors are temporally aligned. Local buffering stores up to
              72 hours of data locally in case of network connectivity loss, automatically forwarding when connectivity
              is restored.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The edge nodes also perform preliminary cross-sensor consistency checks. For example, if the energy meter
              shows zero consumption but the CO2 flow meter shows non-zero flow, the edge node flags the inconsistency
              immediately rather than waiting for the cloud-based verification engine to detect it.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
              <MetricCard value="30s" label="Data aggregation window" />
              <MetricCard value="72h" label="Local buffer capacity" />
              <MetricCard value="1ms" label="GPS timestamp accuracy" />
              <MetricCard value="99.2%" label="Sensor uptime (pilot)" />
            </div>

            <h2 id="calibration" className="text-2xl font-bold text-white mt-12 mb-4">
              Calibration and Drift Management
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Sensor accuracy degrades over time due to environmental exposure, chemical contamination, and component aging.
              Managing this drift is essential for maintaining verification integrity. TerraQura implements a three-tier
              calibration protocol. Factory calibration establishes baseline accuracy when sensors are manufactured, with
              NIST-traceable reference standards. This calibration certificate is stored on-chain as part of the sensor&apos;s
              digital identity.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Field calibration is performed quarterly by certified technicians using portable reference standards. Each
              field calibration generates a calibration record that is cryptographically signed and submitted to the
              blockchain, updating the sensor&apos;s accuracy profile. If a calibration reveals drift exceeding predefined
              thresholds, the affected sensor&apos;s data is retroactively flagged and the verification engine recalculates
              confidence scores for credits generated during the drift period.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              Continuous drift detection uses statistical methods to identify gradual calibration shift between formal
              calibration events. By comparing readings from redundant sensors measuring the same physical parameter,
              the system can detect when one sensor is drifting relative to its peers and adjust uncertainty bounds
              accordingly.
            </p>

            <h2 id="tamper-resistance" className="text-2xl font-bold text-white mt-12 mb-4">
              Tamper Resistance and Security
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The integrity of Proof-of-Physics depends on the assumption that sensor data has not been manipulated between
              measurement and on-chain attestation. Tamper resistance is implemented at multiple levels. At the physical
              level, sensors are installed in tamper-evident enclosures with breakable seals. Opening the enclosure is
              logged and triggers an alert. Wiring between sensors and edge nodes runs through sealed conduit with
              continuity monitoring.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              At the firmware level, sensors run signed firmware that cannot be modified without cryptographic authorization.
              The firmware includes a secure boot chain that verifies the integrity of the measurement code before execution.
              Each sensor has a unique private key stored in a hardware security element that cannot be extracted, and all
              sensor readings are signed with this key before transmission.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              At the data level, cryptographic hash chains link consecutive readings, making it computationally infeasible
              to insert, modify, or delete readings without detection. The edge nodes verify these hash chains and reject
              any data that fails chain validation. The cloud ingestion gateway performs a second independent verification.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              At the network level, all communication between sensors, edge nodes, and the cloud uses TLS 1.3 with
              certificate pinning. The edge nodes accept connections only from pre-authorized sensors, preventing rogue
              devices from injecting data into the pipeline.
            </p>

            <h2 id="redundancy" className="text-2xl font-bold text-white mt-12 mb-4">
              Redundancy and Fault Tolerance
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Individual sensor failures must not compromise verification integrity. TerraQura&apos;s sensor deployment
              standard requires a minimum of 2x redundancy for all critical measurement points: at least two CO2 flow
              meters, two energy meters, and two temperature sensors at each key process location. For the most critical
              measurements (CO2 output flow), 3x redundancy is specified.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Redundant sensors use different measurement principles where possible (for example, a Coriolis flow meter
              paired with an ultrasonic flow meter) to reduce the risk of common-mode failures. The verification engine
              uses a weighted consensus algorithm that produces valid readings as long as a majority of redundant sensors
              agree within their combined uncertainty bounds.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              When a sensor fails, the system continues to operate with reduced redundancy and increased reported
              uncertainty. If redundancy falls below the minimum threshold, the verification engine automatically
              reduces the confidence score for affected batches, potentially dropping them below the minting threshold
              until the failed sensor is replaced.
            </p>

            <h2 id="deployment" className="text-2xl font-bold text-white mt-12 mb-4">
              Deployment Considerations
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Deploying a sensor network at a DAC facility requires careful engineering consideration. Environmental
              conditions vary significantly between facility types and locations. Solid sorbent facilities in Iceland
              experience temperatures ranging from -20 to 30 degrees Celsius with high humidity, while liquid solvent
              facilities in arid regions face temperatures up to 50 degrees Celsius with corrosive chemical environments
              near the calciner.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Sensor placement must account for process-specific factors: measurement points upstream and downstream of
              each major process stage, locations with representative flow conditions (avoiding elbows, valves, and other
              flow disturbances), and accessibility for maintenance and calibration. TerraQura works with facility operators
              during the design phase to develop site-specific sensor placement plans that balance measurement accuracy
              with practical installation constraints.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-6">
              The total cost of sensor instrumentation for a typical DAC facility ranges from $200,000 to $500,000,
              depending on facility size and complexity. This amortizes to approximately $0.50 to $2.00 per tonne of CO2
              over the expected 15 to 20 year facility lifetime, far less than the $15,000 to $50,000 per audit cycle
              cost of traditional MRV.
            </p>

            <h2 id="conclusion" className="text-2xl font-bold text-white mt-12 mb-4">
              Conclusion
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              The sensor network is the foundation upon which all of Proof-of-Physics rests. Without accurate, tamper-resistant,
              and continuously available physical measurements, no amount of algorithmic sophistication or blockchain
              immutability can produce a trustworthy carbon credit. TerraQura invests heavily in this physical infrastructure
              because we understand that the credibility of every credit we verify ultimately traces back to the quality
              of the measurements.
            </p>
            <p className="text-white/70 font-body leading-relaxed mb-8">
              As DAC technology evolves and new capture modalities emerge, the sensor network will evolve with them. But the
              fundamental principles, accuracy, tamper-resistance, redundancy, and continuous operation, will remain constant.
              These are not engineering preferences. They are the minimum requirements for a verification system that
              deserves to be trusted.
            </p>
          </div>

          {/* About blurb */}
          <div className="mt-16 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-2">About TerraQura</h3>
            <p className="text-sm text-white/60 font-body leading-relaxed">
              TerraQura is building institutional-grade carbon verification infrastructure powered by Proof-of-Physics on the
              Aethelred sovereign blockchain. Founded by Zhyra Holdings in Abu Dhabi, TerraQura provides real-time,
              physics-verified carbon credits for enterprise buyers, DAC operators, and institutional investors.
            </p>
          </div>

          <div className="mt-8">
            <Link href="/blog" className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-medium">
              &larr; Back to all articles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
