import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Seed the document types table with the 8-document chain.
 * Should be run once during setup.
 */
export const seed = mutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("documentTypes").collect();
        if (existing.length > 0) {
            return { message: "Already seeded", count: existing.length };
        }

        const types = [
            {
                key: "brd",
                displayName: "Business Requirements Document",
                shortLabel: "BRD",
                order: 1,
                description: "Defines the business problem, objectives, stakeholders, and high-level requirements. The foundation document that everything else builds upon.",
                requiredPredecessorKey: undefined,
                integrationCategories: ["communication", "knowledge_base"],
                templateSections: [
                    { key: "executive_summary", title: "Executive Summary", description: "High-level overview of the project and its objectives", required: true },
                    { key: "business_objectives", title: "Business Objectives", description: "What the business aims to achieve", required: true },
                    { key: "stakeholder_analysis", title: "Stakeholder Analysis", description: "Key stakeholders, their roles, and interests", required: true },
                    { key: "functional_requirements", title: "Functional Requirements", description: "What the system must do", required: true },
                    { key: "non_functional_requirements", title: "Non-Functional Requirements", description: "Performance, security, scalability constraints", required: true },
                    { key: "assumptions_constraints", title: "Assumptions & Constraints", description: "Known assumptions and project constraints", required: true },
                    { key: "success_metrics", title: "Success Metrics", description: "How success will be measured", required: true },
                    { key: "timeline", title: "Timeline & Milestones", description: "Key dates and delivery milestones", required: false },
                ],
                icon: "FileText",
                color: "#6366f1",
            },
            {
                key: "prd",
                displayName: "Product Requirements Document",
                shortLabel: "PRD",
                order: 2,
                description: "Translates business requirements into product features, user stories, and acceptance criteria. Bridges business needs and technical implementation.",
                requiredPredecessorKey: "brd",
                integrationCategories: ["project_management", "design"],
                templateSections: [
                    { key: "product_overview", title: "Product Overview", description: "What the product is and does", required: true },
                    { key: "user_personas", title: "User Personas", description: "Target users and their needs", required: true },
                    { key: "user_stories", title: "User Stories", description: "Feature descriptions from user perspective", required: true },
                    { key: "feature_specifications", title: "Feature Specifications", description: "Detailed feature breakdown", required: true },
                    { key: "acceptance_criteria", title: "Acceptance Criteria", description: "Conditions for feature completion", required: true },
                    { key: "ux_requirements", title: "UX Requirements", description: "User experience guidelines", required: false },
                    { key: "release_plan", title: "Release Plan", description: "Phased release strategy", required: false },
                ],
                icon: "Package",
                color: "#8b5cf6",
            },
            {
                key: "frd",
                displayName: "Functional Requirements Document",
                shortLabel: "FRD",
                order: 3,
                description: "Details the granular functional specifications — exactly how each feature behaves, inputs, outputs, and business rules.",
                requiredPredecessorKey: "prd",
                integrationCategories: ["project_management", "knowledge_base"],
                templateSections: [
                    { key: "system_overview", title: "System Overview", description: "System scope and context", required: true },
                    { key: "functional_specs", title: "Functional Specifications", description: "Detailed behavior per feature", required: true },
                    { key: "data_requirements", title: "Data Requirements", description: "Data models and validation rules", required: true },
                    { key: "business_rules", title: "Business Rules", description: "Logic and computation rules", required: true },
                    { key: "interface_requirements", title: "Interface Requirements", description: "UI/UX specifications", required: false },
                    { key: "reporting", title: "Reporting Requirements", description: "Reports and analytics needed", required: false },
                ],
                icon: "Cog",
                color: "#a78bfa",
            },
            {
                key: "srs",
                displayName: "Software Requirements Specification",
                shortLabel: "SRS",
                order: 4,
                description: "Complete technical specification covering both functional and non-functional requirements — performance, security, compliance, and system constraints.",
                requiredPredecessorKey: "frd",
                integrationCategories: ["source_control", "project_management"],
                templateSections: [
                    { key: "system_description", title: "System Description", description: "System architecture overview", required: true },
                    { key: "functional_requirements", title: "Functional Requirements", description: "Technical functional specs", required: true },
                    { key: "performance_requirements", title: "Performance Requirements", description: "Speed, throughput, latency targets", required: true },
                    { key: "security_requirements", title: "Security Requirements", description: "Authentication, authorization, encryption", required: true },
                    { key: "interface_specifications", title: "Interface Specifications", description: "API contracts and integrations", required: true },
                    { key: "data_specifications", title: "Data Specifications", description: "Database design and data flow", required: true },
                    { key: "compliance", title: "Compliance Requirements", description: "Regulatory and compliance needs", required: false },
                ],
                icon: "Ruler",
                color: "#7c3aed",
            },
            {
                key: "trd",
                displayName: "Technical Design Document",
                shortLabel: "TRD/SDD",
                order: 5,
                description: "System architecture, database design, API contracts, technology stack decisions, and deployment architecture.",
                requiredPredecessorKey: "srs",
                integrationCategories: ["source_control", "design"],
                templateSections: [
                    { key: "architecture_overview", title: "Architecture Overview", description: "High-level system architecture", required: true },
                    { key: "component_design", title: "Component Design", description: "Individual component specifications", required: true },
                    { key: "database_design", title: "Database Design", description: "Schema, relationships, indexes", required: true },
                    { key: "api_design", title: "API Design", description: "Endpoints, request/response formats", required: true },
                    { key: "technology_stack", title: "Technology Stack", description: "Tools, frameworks, and services", required: true },
                    { key: "deployment", title: "Deployment Architecture", description: "Infrastructure and CI/CD", required: false },
                ],
                icon: "Building",
                color: "#6d28d9",
            },
            {
                key: "test_plan",
                displayName: "Test Plan",
                shortLabel: "Test Plan",
                order: 6,
                description: "Testing strategy, test cases, environments, and coverage requirements. Validates the system against all specifications.",
                requiredPredecessorKey: "trd",
                integrationCategories: ["testing"],
                templateSections: [
                    { key: "test_strategy", title: "Test Strategy", description: "Overall testing approach", required: true },
                    { key: "test_scope", title: "Test Scope", description: "What will and won't be tested", required: true },
                    { key: "test_cases", title: "Test Cases", description: "Individual test scenarios", required: true },
                    { key: "test_environment", title: "Test Environment", description: "Hardware, software, data setup", required: true },
                    { key: "test_schedule", title: "Test Schedule", description: "Timeline for testing phases", required: false },
                    { key: "risk_analysis", title: "Risk Analysis", description: "Testing risks and mitigations", required: false },
                ],
                icon: "TestTube",
                color: "#5b21b6",
            },
            {
                key: "uat",
                displayName: "User Acceptance Testing Document",
                shortLabel: "UAT",
                order: 7,
                description: "Acceptance criteria verification by end-users. Ensures the final product meets the original business requirements from the BRD.",
                requiredPredecessorKey: "test_plan",
                integrationCategories: ["communication", "signing"],
                templateSections: [
                    { key: "uat_objectives", title: "UAT Objectives", description: "What acceptance testing aims to verify", required: true },
                    { key: "acceptance_criteria", title: "Acceptance Criteria", description: "Pass/fail criteria per requirement", required: true },
                    { key: "uat_scenarios", title: "UAT Scenarios", description: "End-to-end user testing scenarios", required: true },
                    { key: "sign_off", title: "Sign-Off", description: "Stakeholder approval section", required: true },
                    { key: "defect_log", title: "Defect Log", description: "Issues found during UAT", required: false },
                ],
                icon: "CheckCircle",
                color: "#4c1d95",
            },
            {
                key: "rtm",
                displayName: "Requirements Traceability Matrix",
                shortLabel: "RTM",
                order: 8,
                description: "Maps every requirement from BRD through design, implementation, and testing. Auto-generated from the complete document chain.",
                requiredPredecessorKey: "uat",
                integrationCategories: [],
                templateSections: [
                    { key: "requirement_mapping", title: "Requirement Mapping", description: "BRD requirement → PRD feature → FRD spec → SRS detail → test case", required: true },
                    { key: "coverage_analysis", title: "Coverage Analysis", description: "Percentage of requirements traced end-to-end", required: true },
                    { key: "gap_analysis", title: "Gap Analysis", description: "Requirements not fully traced", required: true },
                ],
                icon: "Grid",
                color: "#3b0764",
            },
        ];

        for (const docType of types) {
            await ctx.db.insert("documentTypes", docType as any);
        }

        return { message: "Seeded document types", count: types.length };
    },
});

/**
 * Get all document types in chain order
 */
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("documentTypes")
            .withIndex("by_order")
            .collect();
    },
});

/**
 * Get a single document type by key
 */
export const getByKey = query({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("documentTypes")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .unique();
    },
});
