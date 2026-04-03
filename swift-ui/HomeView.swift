// Drop this file into an iOS target. Add Playfair Display + Inter (regular, italic, light)
// to the app bundle and Info.plist UIAppFonts, or change HomeFont to map your PostScript names.

import SwiftUI
import UIKit

// MARK: - Grayscale palette (#FFFFFF background; ink + grays only)
private enum HomeColor {
    static let background = Color.white
    static let ink = Color(red: 17 / 255, green: 17 / 255, blue: 17 / 255) // #111111
    static let gray8A = Color(red: 138 / 255, green: 138 / 255, blue: 138 / 255) // #8A8A8A
    static let grayA0 = Color(red: 160 / 255, green: 160 / 255, blue: 160 / 255) // #A0A0A0
    static let gray33 = Color(red: 51 / 255, green: 51 / 255, blue: 51 / 255) // #333333
    static let gray9A = Color(red: 154 / 255, green: 154 / 255, blue: 154 / 255) // #9A9A9A
}

// MARK: - Typography (add Playfair Display + Inter to target; falls back to system)
private enum HomeFont {
    /// PostScript names vary; adjust to match your bundled fonts.
    private static let playfairRegular = "PlayfairDisplay-Regular"
    private static let playfairItalic = "PlayfairDisplay-Italic"
    private static let interRegular = "Inter-Regular"
    private static let interItalic = "Inter-Italic"
    private static let interLight = "Inter-Light"

    static func playfair(_ size: CGFloat) -> Font {
        .custom(playfairRegular, size: size)
    }

    static func playfairItalic(_ size: CGFloat) -> Font {
        .custom(playfairItalic, size: size)
    }

    static func inter(_ size: CGFloat) -> Font {
        .custom(interRegular, size: size)
    }

    static func interItalic(_ size: CGFloat) -> Font {
        .custom(interItalic, size: size)
    }

    static func interLight(_ size: CGFloat) -> Font {
        .custom(interLight, size: size)
    }

    static func monoLabel(_ size: CGFloat = 8) -> Font {
        .system(size: size, weight: .bold, design: .monospaced)
    }

    static func monoLog(_ size: CGFloat = 12) -> Font {
        .system(size: size, weight: .bold, design: .monospaced)
    }
}

// MARK: - Hero
private struct HomeHero: View {
    let hoursText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("RECLAIMED HOURS")
                .font(HomeFont.monoLabel(8))
                .tracking(4)
                .foregroundStyle(HomeColor.grayA0)
                .textCase(.uppercase)
                .padding(.bottom, 10)

            Text(hoursText)
                .font(HomeFont.playfair(112))
                .foregroundStyle(HomeColor.ink)
                .lineSpacing(-4)
                .minimumScaleFactor(0.38)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Metric column
private struct HomeMetricColumn: View {
    let label: String
    let value: String
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(HomeFont.monoLabel(8))
                .tracking(3)
                .foregroundStyle(HomeColor.grayA0)
                .textCase(.uppercase)
                .padding(.bottom, 8)

            Text(value)
                .font(HomeFont.interLight(34))
                .foregroundStyle(HomeColor.ink)
                .minimumScaleFactor(0.85)
                .lineLimit(2)

            Text(caption)
                .font(HomeFont.inter(11))
                .foregroundStyle(HomeColor.gray8A)
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Danger zone
private struct HomeDangerZone: View {
    let title: String
    let bodyText: String
    let subline: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(HomeFont.playfair(22))
                .foregroundStyle(HomeColor.ink)
                .padding(.bottom, 14)

            Text(bodyText)
                .font(HomeFont.inter(15))
                .foregroundStyle(HomeColor.gray33)
                .fixedSize(horizontal: false, vertical: true)

            if let subline, !subline.isEmpty {
                Text(subline)
                    .font(HomeFont.inter(13))
                    .foregroundStyle(HomeColor.gray9A)
                    .padding(.top, 12)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Footer
private struct HomeFooter: View {
    let onLog: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: {
                let gen = UIImpactFeedbackGenerator(style: .light)
                gen.prepare()
                gen.impactOccurred()
                onLog()
            }) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("LOG")
                        .font(HomeFont.monoLog(12))
                        .tracking(1.2)
                        .foregroundStyle(HomeColor.ink)
                        .textCase(.uppercase)

                    Text("Name how you feel before you scroll.")
                        .font(HomeFont.inter(11))
                        .foregroundStyle(HomeColor.gray8A)
                        .padding(.top, 8)
                        .frame(maxWidth: 280, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(LogTapStyle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct LogTapStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - HomeView
public struct HomeView: View {
    public var dateString: String
    public var reclaimedHours: String
    public var screenTimeDisplay: String
    public var momentsCount: Int
    public var dangerTitle: String
    public var dangerBody: String
    public var dangerSubline: String?
    public var onJournal: () -> Void
    public var onSettings: () -> Void
    public var onLog: () -> Void

    @State private var appeared = false

    private let horizontalPadding: CGFloat = 40

    public init(
        dateString: String,
        reclaimedHours: String,
        screenTimeDisplay: String,
        momentsCount: Int,
        dangerTitle: String = "Danger zone",
        dangerBody: String,
        dangerSubline: String? = nil,
        onJournal: @escaping () -> Void,
        onSettings: @escaping () -> Void,
        onLog: @escaping () -> Void
    ) {
        self.dateString = dateString
        self.reclaimedHours = reclaimedHours
        self.screenTimeDisplay = screenTimeDisplay
        self.momentsCount = momentsCount
        self.dangerTitle = dangerTitle
        self.dangerBody = dangerBody
        self.dangerSubline = dangerSubline
        self.onJournal = onJournal
        self.onSettings = onSettings
        self.onLog = onLog
    }

    public var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    topBar
                        .padding(.bottom, 20)

                    Text(dateString)
                        .font(HomeFont.inter(13))
                        .foregroundStyle(HomeColor.gray8A)
                        .padding(.bottom, 6)

                    Text("Reclaimed hours.")
                        .font(HomeFont.playfairItalic(20))
                        .foregroundStyle(HomeColor.ink.opacity(0.92))
                        .padding(.bottom, 36)

                    HomeHero(hoursText: reclaimedHours)
                        .padding(.bottom, 44)

                    metricsRow
                        .padding(.bottom, 60)

                    HomeDangerZone(
                        title: dangerTitle,
                        bodyText: dangerBody,
                        subline: dangerSubline
                    )

                    Spacer(minLength: 40)

                    HomeFooter(onLog: onLog)
                        .padding(.top, 8)
                }
                .frame(maxWidth: .infinity, minHeight: geo.size.height, alignment: .topLeading)
                .padding(.horizontal, horizontalPadding)
                .padding(.top, geo.safeAreaInsets.top + 16)
                .padding(.bottom, max(geo.safeAreaInsets.bottom, 16) + 40)
            }
            .scrollIndicators(.hidden)
        }
        .background(HomeColor.background)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 6)
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                appeared = true
            }
        }
    }

    private var topBar: some View {
        HStack {
            Button(action: onJournal) {
                Text("Journal")
                    .font(HomeFont.playfair(14))
                    .foregroundStyle(HomeColor.ink)
            }
            .buttonStyle(.plain)

            Spacer(minLength: 0)

            Button(action: onSettings) {
                Text("Settings")
                    .font(HomeFont.playfair(14))
                    .foregroundStyle(HomeColor.ink)
            }
            .buttonStyle(.plain)
        }
    }

    private var metricsRow: some View {
        HStack(alignment: .top, spacing: 28) {
            HomeMetricColumn(
                label: "SCREEN TIME",
                value: screenTimeDisplay,
                caption: "Today"
            )
            HomeMetricColumn(
                label: "MOMENTS",
                value: "\(momentsCount)",
                caption: "Reclaimed today"
            )
        }
    }
}

// MARK: - Preview
#Preview {
    HomeView(
        dateString: "Friday, April 3",
        reclaimedHours: "12",
        screenTimeDisplay: "5.2 hrs",
        momentsCount: 3,
        dangerBody: "You are more likely to rot between 9pm and 10pm when feeling Bored.",
        dangerSubline: nil,
        onJournal: {},
        onSettings: {},
        onLog: {}
    )
}
